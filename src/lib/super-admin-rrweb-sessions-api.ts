import { API_BASE_URL } from "@/lib/api-base-url";
import { apiAuthFetch } from "@/lib/api-auth";
import { ApiError } from "@/lib/auth-api";

export type RrwebSessionOwner = {
  userId: string;
  email: string;
  name?: string;
  sessionCount: number;
  /** Sessions with reviewed === false. Hide badge when 0. */
  uncheckedCount: number;
  lastStartedAt?: string;
};

export type RrwebSessionUser = {
  userId: string;
  email: string;
  name?: string;
};

export type RrwebSessionStatus =
  | "recording"
  | "uploaded"
  | "failed"
  | "deleted"
  | string;

/** One apply attempt (may span SPA navigations / related tabs). */
export type AdminRrwebSession = {
  id: string;
  userId: string;
  clientSessionId?: string;
  primaryUrl: string;
  pageTitle: string | null;
  status: RrwebSessionStatus;
  eventCount: number;
  durationMs: number;
  frameCount: number;
  /** Gzip/events payload size in bytes (from list/detail API). */
  eventsBytes?: number;
  /**
   * Signed B2 URL — metadata only. NEVER fetch from the browser (CORS).
   * Load bytes via `eventsPath` instead.
   */
  eventsUrl?: string;
  /** Same-origin admin path, e.g. `/admin/rrweb-sessions/:id/events`. Prefer this. */
  eventsPath?: string;
  /** Present on detail; `gzip` when payload is compressed. */
  eventsEncoding?: "gzip" | "json" | string | null;
  /** Optional backend hints for replay (frame order, etc.). */
  replayHints?: RrwebReplayHints | null;
  /**
   * Backend: partial/full B2 sync available. Recording needs this true
   * before play; uploaded usually true when events exist.
   */
  replayable?: boolean;
  reviewed: boolean;
  reviewedAt?: string | null;
  startedAt: string;
  endedAt?: string | null;
  user?: RrwebSessionUser;
};

export type RrwebEventFrame = {
  frameKey: string;
  href?: string;
  isTop: boolean;
  events: unknown[];
};

export type RrwebSessionEventsPayload = {
  version: number;
  clientSessionId?: string;
  frames: RrwebEventFrame[];
};

export type RrwebReplayHints = {
  skipInactive?: boolean;
  preferTopFrame?: boolean;
  grayscaleOk?: boolean;
  liveReplay?: boolean;
  [key: string]: unknown;
};

export type AdminRrwebSessionDetail = AdminRrwebSession & {
  /** Only present when caller used `?includeEvents=1` (avoid in production). */
  events?: RrwebSessionEventsPayload | null;
};

export type AdminRrwebSessionListResponse = {
  sessions: AdminRrwebSession[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

function pickString(data: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return fallback;
}

function parseReviewedFlag(raw: unknown): boolean | undefined {
  if (typeof raw === "boolean") return raw;
  if (raw === "false" || raw === 0) return false;
  if (raw === "true" || raw === 1) return true;
  return undefined;
}

function parseBoolFlag(raw: unknown): boolean | undefined {
  return parseReviewedFlag(raw);
}

function throwAdminError(res: Response, data: Record<string, unknown>): never {
  const message =
    (typeof data.message === "string" && data.message) ||
    (typeof data.error === "string" && data.error) ||
    (res.status === 403
      ? "Admin access required. Sign in with a super-admin account."
      : res.status === 401
        ? "Sign in to Devora21 first, then open Super Admin."
        : "Request failed");
  throw new ApiError(message, res.status, { message });
}

async function adminJson(
  path: string,
  options: RequestInit = {}
): Promise<Record<string, unknown>> {
  const res = await apiAuthFetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });
  const data = await parseJson(res);
  if (!res.ok) throwAdminError(res, data);
  return data;
}

function parseSessionUser(raw: unknown): RrwebSessionUser | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Record<string, unknown>;
  const userId = pickString(row, "userId", "user_id", "id");
  const email = pickString(row, "email");
  const name = pickString(row, "name", "fullName", "full_name");
  if (!userId && !email && !name) return undefined;
  return {
    userId: userId || email,
    email,
    ...(name ? { name } : {}),
  };
}

function parseFrame(raw: unknown): RrwebEventFrame | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const frameKey = pickString(row, "frameKey", "frame_key", "key") || "top";
  const href = pickString(row, "href", "url") || undefined;
  const isTop =
    row.isTop === true ||
    row.is_top === true ||
    frameKey === "top" ||
    frameKey === "main";
  const events = Array.isArray(row.events) ? row.events : [];
  return { frameKey, ...(href ? { href } : {}), isTop, events };
}

export function parseRrwebEventsPayload(
  raw: unknown
): RrwebSessionEventsPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const framesRaw = Array.isArray(row.frames) ? row.frames : [];
  const frames = framesRaw
    .map(parseFrame)
    .filter((f): f is RrwebEventFrame => Boolean(f));
  if (!frames.length && !pickString(row, "clientSessionId", "client_session_id")) {
    // Empty payload still valid if version present
    if (row.version == null && !Array.isArray(row.frames)) return null;
  }
  return {
    version: toNumber(row.version, 1) || 1,
    ...(pickString(row, "clientSessionId", "client_session_id")
      ? { clientSessionId: pickString(row, "clientSessionId", "client_session_id") }
      : {}),
    frames,
  };
}

export function parseAdminRrwebSession(raw: unknown): AdminRrwebSession | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = pickString(row, "id");
  if (!id) return null;

  const user = parseSessionUser(row.user ?? row.owner);
  const userId = pickString(row, "userId", "user_id") || user?.userId || "";

  const titleRaw = row.pageTitle ?? row.page_title ?? row.title;
  const pageTitle =
    typeof titleRaw === "string" && titleRaw.trim() ? titleRaw.trim() : null;

  const reviewedRaw = parseReviewedFlag(row.reviewed ?? row.isReviewed ?? row.is_reviewed);
  const reviewed = reviewedRaw === true;
  const replayable = parseBoolFlag(
    row.replayable ?? row.isReplayable ?? row.is_replayable
  );

  const replayHintsRaw =
    row.replayHints && typeof row.replayHints === "object"
      ? (row.replayHints as RrwebReplayHints)
      : row.replay_hints && typeof row.replay_hints === "object"
        ? (row.replay_hints as RrwebReplayHints)
        : null;

  return {
    id,
    userId,
    ...(pickString(row, "clientSessionId", "client_session_id")
      ? { clientSessionId: pickString(row, "clientSessionId", "client_session_id") }
      : {}),
    primaryUrl: pickString(row, "primaryUrl", "primary_url", "url", "tabUrl", "tab_url"),
    pageTitle,
    status: pickString(row, "status") || "uploaded",
    eventCount: toNumber(row.eventCount ?? row.event_count, 0),
    durationMs: toNumber(row.durationMs ?? row.duration_ms, 0),
    frameCount: toNumber(row.frameCount ?? row.frame_count, 0),
    ...(toNumber(
      row.eventsBytes ??
        row.events_bytes ??
        row.byteSize ??
        row.byte_size ??
        row.sizeBytes ??
        row.size_bytes ??
        row.gzipBytes ??
        row.gzip_bytes ??
        row.size,
      0
    )
      ? {
          eventsBytes: toNumber(
            row.eventsBytes ??
              row.events_bytes ??
              row.byteSize ??
              row.byte_size ??
              row.sizeBytes ??
              row.size_bytes ??
              row.gzipBytes ??
              row.gzip_bytes ??
              row.size,
            0
          ),
        }
      : {}),
    ...(pickString(row, "eventsUrl", "events_url")
      ? { eventsUrl: pickString(row, "eventsUrl", "events_url") }
      : {}),
    ...(pickString(row, "eventsPath", "events_path")
      ? { eventsPath: pickString(row, "eventsPath", "events_path") }
      : {}),
    ...(pickString(row, "eventsEncoding", "events_encoding")
      ? {
          eventsEncoding: pickString(
            row,
            "eventsEncoding",
            "events_encoding"
          ) as AdminRrwebSession["eventsEncoding"],
        }
      : row.eventsEncoding === null || row.events_encoding === null
        ? { eventsEncoding: null }
        : {}),
    ...(replayHintsRaw ? { replayHints: replayHintsRaw } : {}),
    ...(replayable !== undefined ? { replayable } : {}),
    reviewed,
    reviewedAt: pickString(row, "reviewedAt", "reviewed_at") || null,
    startedAt:
      pickString(row, "startedAt", "started_at") ||
      pickString(row, "createdAt", "created_at"),
    endedAt: pickString(row, "endedAt", "ended_at") || null,
    ...(user ? { user } : {}),
  };
}

export function parseAdminRrwebSessionDetail(
  raw: unknown
): AdminRrwebSessionDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const base = parseAdminRrwebSession(row.session ?? row);
  if (!base) return null;

  const events =
    parseRrwebEventsPayload(row.events) ||
    (row.session && typeof row.session === "object"
      ? parseRrwebEventsPayload((row.session as Record<string, unknown>).events)
      : null);

  const eventsUrl =
    pickString(row, "eventsUrl", "events_url") ||
    base.eventsUrl ||
    undefined;

  const eventsPath =
    pickString(row, "eventsPath", "events_path") ||
    base.eventsPath ||
    undefined;

  const encodingRaw =
    pickString(row, "eventsEncoding", "events_encoding") ||
    base.eventsEncoding ||
    "";
  const eventsEncoding =
    encodingRaw ||
    (row.eventsEncoding === null ||
    row.events_encoding === null ||
    base.eventsEncoding === null
      ? null
      : undefined);

  const replayHints =
    (row.replayHints && typeof row.replayHints === "object"
      ? (row.replayHints as RrwebReplayHints)
      : null) ||
    (row.replay_hints && typeof row.replay_hints === "object"
      ? (row.replay_hints as RrwebReplayHints)
      : null) ||
    base.replayHints ||
    null;

  return {
    ...base,
    ...(eventsUrl ? { eventsUrl } : {}),
    ...(eventsPath ? { eventsPath } : {}),
    ...(eventsEncoding !== undefined ? { eventsEncoding } : {}),
    ...(replayHints ? { replayHints } : {}),
    ...(events ? { events } : { events: null }),
  };
}

function parseOwner(raw: unknown): RrwebSessionOwner | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const userId = pickString(row, "userId", "user_id", "id");
  if (!userId) return null;
  return {
    userId,
    email: pickString(row, "email"),
    name: pickString(row, "name", "fullName", "full_name") || undefined,
    sessionCount: toNumber(
      row.sessionCount ?? row.session_count ?? row.count ?? row.captureCount,
      0
    ),
    uncheckedCount: toNumber(
      row.uncheckedCount ??
        row.unchecked_count ??
        row.uncheckedSessionCount ??
        row.unchecked_session_count,
      0
    ),
    lastStartedAt:
      pickString(row, "lastStartedAt", "last_started_at", "lastCapturedAt") ||
      undefined,
  };
}

export function displayRrwebOwnerName(
  owner: Pick<RrwebSessionOwner, "name" | "email" | "userId"> | RrwebSessionUser
): string {
  if ("name" in owner && owner.name?.trim()) return owner.name.trim();
  if (owner.email?.trim()) return owner.email.trim();
  if ("userId" in owner && owner.userId) return owner.userId.slice(0, 8) + "…";
  return "Unknown owner";
}

export function hostnameFromRrwebUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || url;
  } catch {
    return url || "—";
  }
}

export function rrwebSessionTitle(
  session: Pick<AdminRrwebSession, "pageTitle" | "primaryUrl">
): string {
  if (session.pageTitle?.trim()) return session.pageTitle.trim();
  return hostnameFromRrwebUrl(session.primaryUrl) || "Apply attempt";
}

export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/** Compact payload size for Super Admin list (e.g. 150 KB). */
export function formatRrwebBytes(bytes: number | undefined | null): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) {
    return "";
  }
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) {
    const rounded = kb >= 100 ? Math.round(kb) : Math.round(kb * 10) / 10;
    return `${rounded} KB`;
  }
  const mb = kb / 1024;
  const rounded = mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10;
  return `${rounded} MB`;
}

export const superAdminRrwebSessionsApi = {
  async listOwners(): Promise<RrwebSessionOwner[]> {
    const data = await adminJson("/admin/rrweb-sessions/owners");
    const raw = Array.isArray(data.owners)
      ? data.owners
      : Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.data)
          ? data.data
          : [];
    return raw
      .map(parseOwner)
      .filter((owner): owner is RrwebSessionOwner => Boolean(owner))
      .sort((a, b) => {
        const byLast = (b.lastStartedAt || "").localeCompare(a.lastStartedAt || "");
        if (byLast) return byLast;
        return displayRrwebOwnerName(a).localeCompare(displayRrwebOwnerName(b));
      });
  },

  async listSessions(
    params: {
      userId?: string;
      q?: string;
      date?: string;
      timezone?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<AdminRrwebSessionListResponse> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 25));
    const search = new URLSearchParams();
    search.set("page", String(page));
    search.set("limit", String(limit));
    if (params.userId?.trim()) search.set("userId", params.userId.trim());
    if (params.q?.trim()) search.set("q", params.q.trim());
    if (params.date?.trim()) search.set("date", params.date.trim());
    if (params.timezone?.trim()) search.set("timezone", params.timezone.trim());

    const data = await adminJson(`/admin/rrweb-sessions?${search.toString()}`);
    const sessionsRaw = Array.isArray(data.sessions)
      ? data.sessions
      : Array.isArray(data.items)
        ? data.items
        : [];

    const sessions = sessionsRaw
      .map(parseAdminRrwebSession)
      .filter((s): s is AdminRrwebSession => Boolean(s));

    const total = toNumber(data.total, sessions.length);
    const totalPages =
      toNumber(data.totalPages ?? data.total_pages, 0) ||
      Math.max(1, Math.ceil(total / limit));

    return {
      sessions,
      page: toNumber(data.page, page),
      limit: toNumber(data.limit, limit),
      total,
      totalPages,
    };
  },

  async getSession(id: string): Promise<AdminRrwebSessionDetail> {
    const sid = id.trim();
    if (!sid) throw new ApiError("Missing session id.", 400);
    const data = await adminJson(`/admin/rrweb-sessions/${encodeURIComponent(sid)}`);
    const session = parseAdminRrwebSessionDetail(data.session ?? data);
    if (!session) {
      throw new ApiError("Replay session not found.", 404, {
        message: "Replay session not found.",
      });
    }
    return session;
  },

  async reviewSession(id: string): Promise<AdminRrwebSession> {
    const sid = id.trim();
    if (!sid) throw new ApiError("Missing session id.", 400);
    const data = await adminJson(
      `/admin/rrweb-sessions/${encodeURIComponent(sid)}/review`,
      { method: "POST" }
    );
    const session = parseAdminRrwebSession(data.session ?? data);
    if (!session) {
      throw new ApiError("Review response missing session.", 502, {
        message: "Review response missing session.",
      });
    }
    return session;
  },

  async deleteSession(id: string): Promise<void> {
    const sid = id.trim();
    if (!sid) throw new ApiError("Missing session id.", 400);
    await adminJson(`/admin/rrweb-sessions/${encodeURIComponent(sid)}`, {
      method: "DELETE",
    });
  },
};

/** Resolve same-origin admin events path (never B2 `eventsUrl`). */
export function resolveRrwebEventsPath(
  session: Pick<AdminRrwebSession, "id" | "eventsPath">
): string {
  const raw = session.eventsPath?.trim();
  if (raw) {
    if (/^https?:\/\//i.test(raw)) return raw;
    return raw.startsWith("/") ? raw : `/${raw}`;
  }
  const sid = session.id?.trim();
  if (!sid) {
    throw new ApiError("Missing session id for events path.", 400);
  }
  return `/admin/rrweb-sessions/${encodeURIComponent(sid)}/events`;
}

function parseEventsJsonText(jsonText: string): RrwebSessionEventsPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText) as unknown;
  } catch {
    throw new ApiError("Replay events JSON was invalid.", 502, {
      message: "Replay events JSON was invalid.",
    });
  }
  const parsed = parseRrwebEventsPayload(raw);
  if (!parsed) {
    throw new ApiError("Replay events JSON was invalid.", 502, {
      message: "Replay events JSON was invalid.",
    });
  }
  return parsed;
}

async function gunzipToText(source: ReadableStream<Uint8Array>): Promise<string> {
  if (typeof DecompressionStream === "undefined") {
    throw new ApiError(
      "Gzip replay requires DecompressionStream (modern browser).",
      500,
      { message: "Gzip replay requires DecompressionStream (modern browser)." }
    );
  }
  // Cast: DOM lib typings for DecompressionStream vs ReadableStream generics mismatch.
  const stream = source.pipeThrough(
    new DecompressionStream("gzip") as unknown as ReadableWritablePair<
      Uint8Array,
      Uint8Array
    >
  );
  return new Response(stream).text();
}

export type RrwebEventsLoadResult = {
  payload: RrwebSessionEventsPayload;
  /** Wire size of the downloaded events body (gzip bytes when compressed). */
  eventsBytes: number;
};

/** In-memory cache — avoids re-downloading finished sessions in the same page session. */
const rrwebEventsMemoryCache = new Map<
  string,
  { result: RrwebEventsLoadResult; eventCount: number; status: string }
>();

export function clearRrwebEventsMemoryCache(sessionId?: string): void {
  if (!sessionId) {
    rrwebEventsMemoryCache.clear();
    return;
  }
  rrwebEventsMemoryCache.delete(sessionId.trim());
}

function eventsCacheKey(sessionId: string): string {
  return sessionId.trim();
}

/**
 * Load events via authenticated GET /admin/rrweb-sessions/:id/events.
 * Streams gzip decode while downloading when possible (faster than buffer→copy→gunzip).
 * Never browser-fetch B2 `eventsUrl` (CORS). Avoid `?includeEvents=1`.
 */
export async function loadRrwebPayloadFromApi(
  session: Pick<
    AdminRrwebSession,
    "id" | "eventsPath" | "eventsEncoding" | "status" | "eventCount"
  >,
  opts?: { bypassCache?: boolean }
): Promise<RrwebEventsLoadResult> {
  const sid = session.id?.trim() || "";
  const status = (session.status || "").toLowerCase();
  const cacheKey = eventsCacheKey(sid);
  if (!opts?.bypassCache && sid && status === "uploaded") {
    const hit = rrwebEventsMemoryCache.get(cacheKey);
    if (hit && hit.status === "uploaded") {
      return hit.result;
    }
  }

  const path = resolveRrwebEventsPath(session);
  const url = /^https?:\/\//i.test(path)
    ? path
    : `${API_BASE_URL.replace(/\/$/, "")}${path}`;

  const res = await apiAuthFetch(url, {
    method: "GET",
    headers: {
      Accept: "application/gzip, application/json, */*",
    },
    // Finished sessions may be cached by the browser briefly; recording always fresh.
    cache: status === "recording" ? "no-store" : "default",
  });
  if (!res.ok) {
    const data = await parseJson(res).catch(() => ({}));
    throwAdminError(res, data);
  }

  const headerLen = Number(res.headers.get("content-length") || 0);
  const headerEnc = (
    res.headers.get("X-Events-Encoding") ||
    res.headers.get("x-events-encoding") ||
    ""
  ).toLowerCase();
  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  const encodingHint =
    headerEnc ||
    (session.eventsEncoding || "").toLowerCase() ||
    (contentType.includes("gzip")
      ? "gzip"
      : contentType.includes("json")
        ? "json"
        : "");

  const looksGzipHeader =
    encodingHint === "gzip" || contentType.includes("gzip");

  let jsonText: string;
  let eventsBytes =
    Number.isFinite(headerLen) && headerLen > 0 ? headerLen : 0;

  // Stream gunzip while bytes arrive (avoids full-buffer + extra copy).
  if (looksGzipHeader && res.body) {
    jsonText = await gunzipToText(res.body);
  } else {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (!eventsBytes) eventsBytes = buf.byteLength;
    const magicGzip = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
    if (magicGzip || encodingHint === "gzip") {
      const copy = new Uint8Array(buf.byteLength);
      copy.set(buf);
      jsonText = await gunzipToText(new Blob([copy]).stream());
    } else {
      jsonText = new TextDecoder("utf-8").decode(buf);
    }
  }

  const payload = parseEventsJsonText(jsonText);
  const result: RrwebEventsLoadResult = {
    payload,
    eventsBytes: eventsBytes || 0,
  };

  if (sid && status === "uploaded") {
    rrwebEventsMemoryCache.set(cacheKey, {
      result,
      eventCount: session.eventCount || 0,
      status: "uploaded",
    });
  }

  return result;
}

/** @deprecated Use loadRrwebPayloadFromApi — browser must not fetch B2 eventsUrl. */
export async function loadRrwebPayload(
  _eventsUrl: string,
  _encoding?: string | null
): Promise<RrwebSessionEventsPayload> {
  throw new ApiError(
    "Do not fetch eventsUrl from the browser (CORS). Use GET /admin/rrweb-sessions/:id/events.",
    400,
    {
      message:
        "Do not fetch eventsUrl from the browser (CORS). Use GET /admin/rrweb-sessions/:id/events.",
    }
  );
}

/**
 * Prefer same-origin events API; fall back to rare inlined `events` only.
 * Never fetches `eventsUrl`.
 */
export async function loadRrwebEventsPayload(
  detail: AdminRrwebSessionDetail,
  opts?: { bypassCache?: boolean }
): Promise<RrwebEventsLoadResult> {
  if (detail.events?.frames?.length) {
    return {
      payload: detail.events,
      eventsBytes: detail.eventsBytes || 0,
    };
  }
  return loadRrwebPayloadFromApi(detail, opts);
}

export function pickDefaultRrwebFrame(
  frames: RrwebEventFrame[]
): RrwebEventFrame | null {
  if (!frames.length) return null;
  return frames.find((f) => f.isTop) || frames.find((f) => f.frameKey === "top") || frames[0];
}

export function rrwebSessionActivityIso(
  session: Pick<AdminRrwebSession, "startedAt" | "endedAt">
): string {
  return session.startedAt || session.endedAt || "";
}

/** Recording first, then startedAt desc. */
export function sortRrwebSessionsRecent(
  sessions: AdminRrwebSession[]
): AdminRrwebSession[] {
  return [...sessions].sort((a, b) => {
    const aRec = a.status.toLowerCase() === "recording" ? 0 : 1;
    const bRec = b.status.toLowerCase() === "recording" ? 0 : 1;
    if (aRec !== bRec) return aRec - bRec;
    return rrwebSessionActivityIso(b).localeCompare(rrwebSessionActivityIso(a));
  });
}

export function upsertRrwebSessionList(
  prev: AdminRrwebSession[],
  session: AdminRrwebSession
): AdminRrwebSession[] {
  const without = prev.filter((s) => s.id !== session.id);
  return sortRrwebSessionsRecent([session, ...without]);
}

export function mergeRrwebSession(
  prev: AdminRrwebSession | AdminRrwebSessionDetail | null | undefined,
  incoming: AdminRrwebSession | AdminRrwebSessionDetail
): AdminRrwebSessionDetail {
  if (!prev || prev.id !== incoming.id) {
    return { ...incoming, events: "events" in incoming ? incoming.events ?? null : null };
  }
  const prevDetail = prev as AdminRrwebSessionDetail;
  const nextDetail = incoming as AdminRrwebSessionDetail;
  const events =
    nextDetail.events?.frames?.length
      ? nextDetail.events
      : prevDetail.events ?? nextDetail.events ?? null;

  // Prefer incoming status always (never keep local "recording" after backend uploads).
  const incomingStatus =
    typeof incoming.status === "string" && incoming.status.trim()
      ? incoming.status.trim()
      : "";

  return {
    ...prevDetail,
    ...nextDetail,
    status: incomingStatus || nextDetail.status || prevDetail.status,
    events,
    eventsUrl: nextDetail.eventsUrl || prevDetail.eventsUrl,
    eventsPath: nextDetail.eventsPath || prevDetail.eventsPath,
    eventsEncoding:
      nextDetail.eventsEncoding !== undefined
        ? nextDetail.eventsEncoding
        : prevDetail.eventsEncoding,
    // Prefer backend status over stale liveReplay hints on older payloads.
    replayHints: (() => {
      const hints = nextDetail.replayHints ?? prevDetail.replayHints ?? null;
      if (!hints) return null;
      const status = (incomingStatus || nextDetail.status || prevDetail.status || "").toLowerCase();
      if (status !== "recording" && hints.liveReplay) {
        return { ...hints, liveReplay: false };
      }
      return hints;
    })(),
    replayable:
      nextDetail.replayable !== undefined
        ? nextDetail.replayable
        : prevDetail.replayable,
    pageTitle: nextDetail.pageTitle ?? prevDetail.pageTitle,
    user: nextDetail.user ?? prevDetail.user,
    frameCount: Math.max(nextDetail.frameCount || 0, events?.frames.length || 0, prevDetail.frameCount || 0),
    eventsBytes: Math.max(
      nextDetail.eventsBytes || 0,
      prevDetail.eventsBytes || 0
    ) || nextDetail.eventsBytes || prevDetail.eventsBytes,
  };
}

/** Adjust owner uncheckedCount when a session's reviewed flag flips. */
export function adjustOwnerUncheckedCount(
  owners: RrwebSessionOwner[],
  userId: string,
  prevReviewed: boolean | undefined,
  nextReviewed: boolean | undefined
): RrwebSessionOwner[] {
  if (!userId) return owners;
  const prevUnread = prevReviewed === false;
  const nextUnread = nextReviewed === false;
  if (prevUnread === nextUnread) return owners;
  const delta = nextUnread ? 1 : -1;
  return owners.map((owner) => {
    if (owner.userId !== userId) return owner;
    return {
      ...owner,
      uncheckedCount: Math.max(0, (owner.uncheckedCount || 0) + delta),
    };
  });
}

export function isRrwebSessionUnread(
  session: Pick<AdminRrwebSession, "reviewed">
): boolean {
  return session.reviewed === false;
}

/**
 * List/detail badge copy — Recording ONLY when status === "recording".
 * Prefer status over replayHints.liveReplay (callers must pass status).
 */
export function rrwebStatusBadgeLabel(
  status: string
): "Recording" | "Uploaded" | null {
  const key = (status || "").trim().toLowerCase();
  if (key === "recording") return "Recording";
  if (key === "uploaded") return "Uploaded";
  return null;
}

/** Strict: partial/live UI only while backend says recording. */
export function isRrwebSessionRecording(
  session: Pick<AdminRrwebSession, "status"> | null | undefined
): boolean {
  return (session?.status || "").trim().toLowerCase() === "recording";
}

/**
 * Play enabled when backend says so:
 * - recording → replayable === true (partial B2 sync)
 * - uploaded → replayable !== false (events via eventsPath)
 * - failed/deleted → never
 */
export function isRrwebSessionReplayable(
  session: Pick<
    AdminRrwebSession,
    "status" | "replayable" | "eventsUrl" | "eventsPath" | "id"
  >
): boolean {
  const status = (session.status || "").toLowerCase();
  if (status === "failed" || status === "deleted") return false;
  if (status === "recording") return session.replayable === true;
  if (status === "uploaded") {
    if (session.replayable === false) return false;
    return true;
  }
  if (session.replayable === true) return true;
  if (session.replayable === false) return false;
  return Boolean(session.eventsPath?.trim() || session.id?.trim());
}

export function rrwebReplayBlockedReason(
  session: Pick<
    AdminRrwebSession,
    "status" | "replayable" | "eventsUrl" | "eventsPath" | "id"
  >
): string | null {
  if (isRrwebSessionReplayable(session)) return null;
  const status = (session.status || "").toLowerCase();
  if (status === "failed") return "Replay unavailable (failed).";
  if (status === "deleted") return "Replay unavailable (deleted).";
  if (status === "recording") return "Waiting for first upload sync…";
  return "Replay not available yet.";
}

export type RrwebSessionsLiveEvent =
  | { kind: "ready"; at?: string }
  | { kind: "session.created"; at?: string; session: AdminRrwebSession }
  | { kind: "session.updated"; at?: string; session: AdminRrwebSession }
  | { kind: "session.deleted"; at?: string; sessionId: string; userId?: string }
  | {
      kind: "session.reviewed";
      at?: string;
      sessionId: string;
      userId?: string;
      session?: AdminRrwebSession;
    };

export function parseRrwebSessionsLiveEvent(
  eventName: string,
  data: unknown
): RrwebSessionsLiveEvent | null {
  const row =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const at = pickString(row, "at") || undefined;
  const type =
    pickString(row, "type") ||
    (eventName && eventName !== "message" ? eventName.trim() : "");

  if (type === "ready") {
    return { kind: "ready", at };
  }

  if (type === "session.created" || type === "session.updated") {
    const session = parseAdminRrwebSession(row.session ?? row);
    if (!session) return null;
    return { kind: type, at, session };
  }

  if (type === "session.deleted") {
    const sessionId =
      pickString(row, "sessionId", "session_id", "id") ||
      (row.session && typeof row.session === "object"
        ? pickString(row.session as Record<string, unknown>, "id")
        : "");
    if (!sessionId) return null;
    const userId =
      pickString(row, "userId", "user_id") ||
      (row.session && typeof row.session === "object"
        ? pickString(row.session as Record<string, unknown>, "userId", "user_id")
        : "") ||
      undefined;
    return { kind: "session.deleted", at, sessionId, ...(userId ? { userId } : {}) };
  }

  if (type === "session.reviewed") {
    const sessionId =
      pickString(row, "sessionId", "session_id") ||
      (row.session && typeof row.session === "object"
        ? pickString(row.session as Record<string, unknown>, "id")
        : "");
    if (!sessionId) return null;
    const userId = pickString(row, "userId", "user_id") || undefined;
    const session =
      row.session && typeof row.session === "object"
        ? parseAdminRrwebSession(row.session)
        : undefined;
    return {
      kind: "session.reviewed",
      at,
      sessionId,
      ...(userId ? { userId } : {}),
      ...(session ? { session } : {}),
    };
  }

  return null;
}

export type RrwebSessionsStreamTicket = {
  ticket: string;
  expiresIn?: number;
  streamPath: string;
};

/**
 * Mint a short-lived SSE ticket (EventSource cannot set Authorization).
 */
export async function createRrwebSessionsStreamTicket(): Promise<RrwebSessionsStreamTicket> {
  const data = await adminJson("/admin/rrweb-sessions/stream-ticket", {
    method: "POST",
  });
  const ticket =
    pickString(data, "ticket", "streamTicket", "stream_ticket", "token") || "";
  const streamPath =
    pickString(data, "streamPath", "stream_path", "path", "url") ||
    "/admin/rrweb-sessions/stream";
  if (!ticket) {
    throw new ApiError("Stream ticket missing from response.", 502);
  }
  const path = streamPath.startsWith("http")
    ? streamPath
    : streamPath.startsWith("/")
      ? `${API_BASE_URL}${streamPath}`
      : `${API_BASE_URL}/${streamPath}`;
  const joiner = path.includes("?") ? "&" : "?";
  return {
    ticket,
    expiresIn: toNumber(data.expiresIn ?? data.expires_in, 0) || undefined,
    streamPath: `${path}${joiner}ticket=${encodeURIComponent(ticket)}&access_token=${encodeURIComponent(ticket)}&token=${encodeURIComponent(ticket)}`,
  };
}
