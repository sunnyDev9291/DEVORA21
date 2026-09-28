import { getUserApiKeyAuthHeader } from "@/lib/user-api-key";
import { refreshAuthSession, shouldSkipAuthRetry } from "@/lib/auth-refresh";

export type ApiAuthMode = "auto" | "cookie" | "bearer";

/**
 * Auth headers for protected API routes.
 * API key mode → Authorization: Bearer dv21_…
 * Cookie mode → empty auth header object (use credentials: "include")
 */
export function getAuthHeaders(mode: ApiAuthMode = "auto"): Record<string, string> {
  if (mode === "cookie") return {};
  return getUserApiKeyAuthHeader();
}

/**
 * Auth for api.devora21.com:
 * - cookie: session cookies only (credentials include)
 * - bearer: Authorization: Bearer dv21_… (still sends credentials)
 * - auto: cookies + optional dv21_ Bearer when stored
 */
export function buildApiAuthHeaders(
  extra?: HeadersInit,
  mode: ApiAuthMode = "auto"
): HeadersInit {
  return {
    ...getAuthHeaders(mode),
    ...normalizeHeaders(extra),
  };
}

function normalizeHeaders(extra?: HeadersInit): Record<string, string> {
  if (!extra) return {};
  if (extra instanceof Headers) {
    const out: Record<string, string> = {};
    extra.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(extra)) {
    return Object.fromEntries(extra);
  }
  return { ...extra };
}

function requestUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

async function rawApiFetch(
  input: string | URL | Request,
  init: RequestInit = {},
  mode: ApiAuthMode = "auto"
): Promise<Response> {
  const { headers: initHeaders, ...rest } = init;
  return fetch(input, {
    ...rest,
    credentials: "include",
    headers: buildApiAuthHeaders(initHeaders, mode),
  });
}

/**
 * fetch() helper that always sends cookies and optionally a dv21_ Bearer key.
 * On 401 (except auth bootstrap routes), runs a single-flight /auth/refresh and retries once.
 * Does not call /auth/logout for transient 401s.
 * For multipart FormData: do not pass Content-Type — the browser sets the boundary.
 */
export async function apiAuthFetch(
  input: string | URL | Request,
  init: RequestInit = {},
  mode: ApiAuthMode = "auto"
): Promise<Response> {
  const url = requestUrl(input);
  const response = await rawApiFetch(input, init, mode);

  if (response.status !== 401) return response;
  if (shouldSkipAuthRetry(url)) return response;
  if (init.signal?.aborted) return response;

  const refreshed = await refreshAuthSession();
  if (!refreshed) return response;

  return rawApiFetch(input, init, mode);
}
