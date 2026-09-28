import { authApi, ApiError, isValidAuthUser } from "@/lib/auth-api";
import { isRefreshDenied, refreshAuthSession } from "@/lib/auth-refresh";
import type { User } from "@/types/auth";

/**
 * Ping while the tab is open so sliding backend sessions stay alive.
 * Access cookies last ~12h; refresh is 7d/30d — keepalive still renews early.
 */
export const SESSION_KEEPALIVE_MS = 10 * 60 * 1000;

export type SessionFetchResult =
  | { status: "authenticated"; user: User }
  | { status: "unauthenticated" }
  | { status: "offline" };

async function tryProactiveRefresh(): Promise<void> {
  if (isRefreshDenied()) return;
  try {
    await refreshAuthSession();
  } catch {
    // Network / non-401 failures are handled by /auth/me below.
  }
}

/**
 * Load the current user. On 401, tries POST /auth/refresh once (shared mutex)
 * before giving up. Network failures return offline so callers keep the user.
 * Does not call /auth/logout.
 */
export async function fetchSessionUser(options?: {
  /** Call POST /auth/refresh first to slide long-lived sessions before they expire. */
  proactiveRefresh?: boolean;
  /**
   * When true, a single failed /auth/me is retried after a short delay
   * (OAuth cookie race after redirect).
   */
  softRetry?: boolean;
}): Promise<SessionFetchResult> {
  if (options?.proactiveRefresh && !isRefreshDenied()) {
    await tryProactiveRefresh();
  }

  const attempt = async (): Promise<SessionFetchResult> => {
    try {
      const { data } = await authApi.getMe({ cookieOnly: true });
      if (isValidAuthUser(data)) {
        return { status: "authenticated", user: data };
      }
      return { status: "unauthenticated" };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        if (isRefreshDenied()) {
          return { status: "unauthenticated" };
        }

        // apiAuthFetch may already have refreshed+retried; try one more shared refresh.
        const refreshed = await refreshAuthSession();
        if (refreshed) {
          try {
            const { data } = await authApi.getMe({ cookieOnly: true });
            if (isValidAuthUser(data)) {
              return { status: "authenticated", user: data };
            }
          } catch (retryError) {
            if (retryError instanceof ApiError && retryError.status >= 500) {
              return { status: "offline" };
            }
            if (retryError instanceof TypeError) {
              return { status: "offline" };
            }
          }
          return { status: "unauthenticated" };
        }

        // Refresh 401 → denied flag set + expired event. Soft failures → offline.
        return isRefreshDenied()
          ? { status: "unauthenticated" }
          : { status: "offline" };
      }

      if (error instanceof ApiError && error.status >= 500) {
        return { status: "offline" };
      }

      if (error instanceof TypeError) {
        return { status: "offline" };
      }

      return { status: "unauthenticated" };
    }
  };

  const first = await attempt();
  if (first.status === "authenticated" || first.status === "offline") {
    return first;
  }

  if (options?.softRetry && !isRefreshDenied()) {
    await new Promise((r) => setTimeout(r, 400));
    const second = await attempt();
    if (second.status !== "unauthenticated") return second;
    if (isRefreshDenied()) return second;
    await new Promise((r) => setTimeout(r, 800));
    return attempt();
  }

  return first;
}
