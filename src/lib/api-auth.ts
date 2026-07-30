import { getUserApiKeyAuthHeader } from "@/lib/user-api-key";

export type ApiAuthMode = "auto" | "cookie" | "bearer";

/**
 * Auth headers for api.devora21.com protected routes.
 * API key mode → Authorization: Bearer dv21_…
 * Cookie mode → empty auth header object (use credentials: "include")
 */
export function getAuthHeaders(mode: ApiAuthMode = "auto"): Record<string, string> {
  if (mode === "cookie") return {};
  return getUserApiKeyAuthHeader();
}

/**
 * Auth for api.devora21.com:
 * - cookie: session JWT only (credentials include)
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

/**
 * fetch() helper that always sends cookies and optionally a dv21_ Bearer key.
 * For multipart FormData: do not pass Content-Type — the browser sets the boundary.
 */
export async function apiAuthFetch(
  input: string,
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
