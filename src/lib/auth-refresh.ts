import { API_BASE_URL, isAuthRefreshPath } from "@/lib/api-base-url";

/**
 * Shared single-flight + multi-tab mutex for POST /auth/refresh.
 * Never call /auth/logout from here — only explicit user logout should.
 */

export const AUTH_SESSION_EXPIRED_EVENT = "devora21:auth-session-expired";

const CHANNEL_NAME = "devora21-auth-refresh";
const STORAGE_LOCK_KEY = "devora21-auth-refresh-lock";
const STORAGE_RESULT_KEY = "devora21-auth-refresh-result";
const LOCK_TTL_MS = 15_000;
/** After refresh returns 401, skip further refresh attempts briefly (stops me/refresh storms). */
const REFRESH_DENIAL_MS = 60_000;

type RefreshResultMessage = {
  type: "refresh-result";
  ok: boolean;
  expired: boolean;
  at: number;
};

type RefreshStartMessage = {
  type: "refresh-start";
  at: number;
};

type RefreshChannelMessage = RefreshResultMessage | RefreshStartMessage;

let inFlight: Promise<boolean> | null = null;
let channel: BroadcastChannel | null = null;
let tabId = "";
let refreshDeniedUntil = 0;

function getTabId(): string {
  if (tabId) return tabId;
  tabId = `tab-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
  return tabId;
}

function notifySessionExpired(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
}

function markRefreshDenied(): void {
  refreshDeniedUntil = Date.now() + REFRESH_DENIAL_MS;
}

/** Call after a successful login/register so refresh is allowed again. */
export function clearRefreshDenial(): void {
  refreshDeniedUntil = 0;
}

export function isRefreshDenied(): boolean {
  return Date.now() < refreshDeniedUntil;
}

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
}

function readLock(): { owner: string; at: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_LOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { owner?: string; at?: number };
    if (!parsed.owner || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > LOCK_TTL_MS) {
      localStorage.removeItem(STORAGE_LOCK_KEY);
      return null;
    }
    return { owner: parsed.owner, at: parsed.at };
  } catch {
    return null;
  }
}

function tryAcquireLock(): boolean {
  if (typeof localStorage === "undefined") return true;
  const existing = readLock();
  const id = getTabId();
  if (existing && existing.owner !== id) return false;
  try {
    localStorage.setItem(STORAGE_LOCK_KEY, JSON.stringify({ owner: id, at: Date.now() }));
    return true;
  } catch {
    return true;
  }
}

function releaseLock(): void {
  if (typeof localStorage === "undefined") return;
  try {
    const existing = readLock();
    if (existing && existing.owner === getTabId()) {
      localStorage.removeItem(STORAGE_LOCK_KEY);
    }
  } catch {
    // ignore
  }
}

function publishResult(ok: boolean, expired: boolean): void {
  const payload: RefreshResultMessage = {
    type: "refresh-result",
    ok,
    expired,
    at: Date.now(),
  };
  try {
    localStorage.setItem(STORAGE_RESULT_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
  getChannel()?.postMessage(payload);
}

function waitForPeerResult(timeoutMs = LOCK_TTL_MS): Promise<boolean | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean | null, expired = false) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      ch?.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
      if (value === false && expired) {
        markRefreshDenied();
        notifySessionExpired();
      }
      resolve(value);
    };

    const onMessage = (event: MessageEvent<RefreshChannelMessage>) => {
      const data = event.data;
      if (data?.type === "refresh-result") {
        finish(data.ok, data.expired);
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_RESULT_KEY || !event.newValue) return;
      try {
        const data = JSON.parse(event.newValue) as RefreshResultMessage;
        if (data?.type === "refresh-result") {
          finish(data.ok, data.expired);
        }
      } catch {
        // ignore
      }
    };

    const ch = getChannel();
    ch?.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);

    const timer = window.setTimeout(() => finish(null), timeoutMs);
  });
}

async function postRefresh(): Promise<{ ok: boolean; expired: boolean }> {
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  if (res.ok) {
    clearRefreshDenial();
    return { ok: true, expired: false };
  }

  // Only treat refresh's own 401 as hard session expiry / no refresh cookie.
  if (res.status === 401) {
    return { ok: false, expired: true };
  }

  // 404/405/5xx: do not force logout — caller may keep existing UI session.
  return { ok: false, expired: false };
}

async function runRefreshLeader(): Promise<boolean> {
  getChannel()?.postMessage({ type: "refresh-start", at: Date.now() } satisfies RefreshStartMessage);

  try {
    const result = await postRefresh();
    publishResult(result.ok, result.expired);
    if (result.expired) {
      markRefreshDenied();
      notifySessionExpired();
    }
    return result.ok;
  } finally {
    releaseLock();
  }
}

/**
 * Refresh the access cookie via POST /auth/refresh.
 * Returns true when refresh succeeded. False means stay put or (if expired event
 * fired) treat as logged out — never calls /auth/logout.
 */
export async function refreshAuthSession(): Promise<boolean> {
  if (isRefreshDenied()) {
    return false;
  }

  if (typeof window === "undefined") {
    const result = await postRefresh();
    if (result.expired) markRefreshDenied();
    return result.ok;
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    if (isRefreshDenied()) return false;

    // Another tab may already be refreshing.
    if (!tryAcquireLock()) {
      const peer = await waitForPeerResult();
      if (peer !== null) return peer;
      // Lock timed out — attempt ourselves.
      if (!tryAcquireLock()) {
        const peerAgain = await waitForPeerResult(5_000);
        if (peerAgain !== null) return peerAgain;
      }
    }

    if (isRefreshDenied()) {
      releaseLock();
      return false;
    }

    return runRefreshLeader();
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/** Whether this URL should skip the automatic 401 → refresh → retry path. */
export function shouldSkipAuthRetry(url: string): boolean {
  if (isRefreshDenied()) return true;
  return isAuthRefreshPath(url) || /\/auth\/(login|register|logout)\/?(\?|$)/.test(
    url.startsWith("http")
      ? (() => {
          try {
            return new URL(url).pathname;
          } catch {
            return url;
          }
        })()
      : url
  );
}
