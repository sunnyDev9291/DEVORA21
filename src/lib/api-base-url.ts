/**
 * Browser auth/API calls use same-origin `/backend/*` (Netlify proxy or Next rewrite)
 * to avoid HTTPS → HTTP mixed-content blocking.
 *
 * Server-side routes (e.g. resume archive) call the VPS directly via BACKEND_API_URL.
 */

const DEFAULT_VPS = "http://31.44.7.64:5000";

function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/** Direct VPS URL — server-side only (Netlify functions, SSR). */
export const BACKEND_API_URL = trimTrailingSlash(
  process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_VPS
);

/**
 * Client-facing API base.
 * - Empty/unset NEXT_PUBLIC_API_BASE_URL → `/backend` (same-origin proxy)
 * - Set to https://api.example.com when the API has TLS
 */
const publicBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
export const API_BASE_URL = trimTrailingSlash(publicBase || "/backend");

/** True when browser requests go through the same-origin proxy path. */
export const USE_API_PROXY = API_BASE_URL === "/backend";
