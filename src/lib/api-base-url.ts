/**
 * Devora21 backend API URL resolution.
 *
 * Browser auth uses https://api.devora21.com directly with credentials: "include"
 * (HttpOnly cookies, SameSite=None). A same-origin `/backend` proxy is optional via
 * NEXT_PUBLIC_API_BASE_URL=/backend, but the default must be the absolute API —
 * Netlify proxying drops/mismatches Set-Cookie Domain and breaks login.
 *
 * Next.js already owns `/api/*` (resume, chat, templates).
 */

export const DEFAULT_API_URL = "https://api.devora21.com";

/** Optional same-origin reverse-proxy prefix (Netlify redirect + next.config rewrite). */
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
 * Absolute API URL by default. Relative `/backend` is ignored — Netlify's proxy
 * does not preserve api.devora21.com Set-Cookie Domain, which broke login.
 */
function resolveBrowserApiBase(envValue: string | undefined): string {
  const trimmed = envValue?.trim();
  if (trimmed && !trimmed.startsWith("/")) {
    return trimTrailingSlash(trimmed);
  }
  return DEFAULT_API_URL;
}

/** Absolute upstream for server/Netlify functions (never a relative path). */
function resolveUpstreamApiBase(envValue: string | undefined): string {
  const trimmed = envValue?.trim();
  if (trimmed && !trimmed.startsWith("/")) {
    return trimTrailingSlash(trimmed);
  }
  if (trimmed && isLocalAbsoluteApi(trimmed)) {
    return trimTrailingSlash(trimmed);
  }
  return DEFAULT_API_URL;
}

/** Browser auth / cookie calls (fetch with credentials). */
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
