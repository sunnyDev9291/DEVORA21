/**
 * Devora21 backend API URL resolution.
 *
 * Browser calls use a same-origin proxy (`/backend`) so session cookies are
 * first-party (avoids Chrome third-party cookie blocking on api.devora21.com).
 * Server-side code talks to the absolute API URL directly.
 *
 * Note: Next.js already owns `/api/*` (resume, chat, templates). Do not proxy
 * that path to the external API — use `/backend` instead.
 */

export const DEFAULT_API_URL = "https://api.devora21.com";

/** Same-origin reverse-proxy prefix (Netlify redirect + next.config rewrite). */
export const SAME_ORIGIN_API_PREFIX = "/backend";

function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

function isLocalAbsoluteApi(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * Browser-facing API base.
 * - Relative env (`/backend`) → use as-is
 * - localhost absolute → use as-is (local API without proxy)
 * - otherwise → same-origin `/backend` (ignore absolute production API URLs)
 */
function resolveBrowserApiBase(envValue: string | undefined): string {
  const trimmed = envValue?.trim();
  if (trimmed?.startsWith("/")) {
    return trimTrailingSlash(trimmed);
  }
  if (trimmed && isLocalAbsoluteApi(trimmed)) {
    return trimTrailingSlash(trimmed);
  }
  return SAME_ORIGIN_API_PREFIX;
}

/** Absolute upstream for server/Netlify functions (never a relative path). */
function resolveUpstreamApiBase(envValue: string | undefined): string {
  const trimmed = envValue?.trim();
  if (trimmed && !trimmed.startsWith("/")) {
    return trimTrailingSlash(trimmed);
  }
  return DEFAULT_API_URL;
}

/** Browser auth / cookie calls (fetch with credentials → same-origin proxy). */
export const API_BASE_URL = resolveBrowserApiBase(process.env.NEXT_PUBLIC_API_BASE_URL);

/** Server-side calls (Netlify functions, Next.js API routes → real API). */
export const BACKEND_API_URL = resolveUpstreamApiBase(
  process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
);

export function isAuthRefreshPath(url: string): boolean {
  try {
    const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0] ?? url;
    return /\/auth\/refresh\/?$/.test(path);
  } catch {
    return url.includes("/auth/refresh");
  }
}
