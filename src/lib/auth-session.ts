import { authApi, ApiError, isValidAuthUser } from "@/lib/auth-api";
import type { User } from "@/types/auth";

/**
 * Ping while the tab is open so sliding backend sessions stay alive.
 * Keep this shorter than a typical short-lived access cookie (often 15–30m).
 */
export const SESSION_KEEPALIVE_MS = 10 * 60 * 1000;

export type SessionFetchResult =
  | { status: "authenticated"; user: User }
  | { status: "unauthenticated" }
  | { status: "offline" };

async function tryProactiveRefresh(): Promise<void> {
  try {
    await authApi.refreshSession();
  } catch {
    // Missing or failed refresh is handled by /auth/me + 401 retry below.
  }
}

/**
 * Load the current user. On 401, tries POST /auth/refresh once before giving up.
 * Network failures return offline so callers can keep the existing client user.
 */
export async function fetchSessionUser(options?: {
  /** Call POST /auth/refresh first to slide long-lived sessions before they expire. */
  proactiveRefresh?: boolean;
}): Promise<SessionFetchResult> {
  if (options?.proactiveRefresh) {
    await tryProactiveRefresh();
  }

  try {
    const { data } = await authApi.getMe({ cookieOnly: true });
    if (isValidAuthUser(data)) {
      return { status: "authenticated", user: data };
    }
    return { status: "unauthenticated" };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      try {
        await authApi.refreshSession();
        const { data } = await authApi.getMe({ cookieOnly: true });
        if (isValidAuthUser(data)) {
          return { status: "authenticated", user: data };
        }
      } catch (refreshError) {
        if (
          refreshError instanceof ApiError &&
          refreshError.status !== 401 &&
          refreshError.status !== 404 &&
          refreshError.status !== 405 &&
          refreshError.status !== 501
        ) {
          return { status: "offline" };
        }
      }
      return { status: "unauthenticated" };
    }

    if (error instanceof ApiError && error.status >= 500) {
      return { status: "offline" };
    }

    if (error instanceof TypeError) {
      return { status: "offline" };
    }

    return { status: "unauthenticated" };
  }
}
