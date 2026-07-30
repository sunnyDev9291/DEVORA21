import { authApi, ApiError, isValidAuthUser } from "@/lib/auth-api";
import type { User } from "@/types/auth";

/** Ping session while the tab is open (extends sliding backend sessions). */
export const SESSION_KEEPALIVE_MS = 45 * 60 * 1000;

export type SessionFetchResult =
  | { status: "authenticated"; user: User }
  | { status: "unauthenticated" }
  | { status: "offline" };

/**
 * Load the current user. On 401, tries POST /auth/refresh once before giving up.
 * Network failures return offline so callers can keep the existing client user.
 */
export async function fetchSessionUser(): Promise<SessionFetchResult> {
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
