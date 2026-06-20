/**
 * Devora21 backend API — browser and server both use https://api.devora21.com by default.
 * Override with NEXT_PUBLIC_API_BASE_URL / BACKEND_API_URL in .env.local or Netlify.
 */

export const DEFAULT_API_URL = "https://api.devora21.com";

function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

function resolveApiBase(envValue: string | undefined): string {
  const trimmed = envValue?.trim();
  if (trimmed) return trimTrailingSlash(trimmed);
  return DEFAULT_API_URL;
}

/** Browser auth calls (fetch with credentials). */
export const API_BASE_URL = resolveApiBase(process.env.NEXT_PUBLIC_API_BASE_URL);

/** Server-side calls (Netlify functions, resume archive route). */
export const BACKEND_API_URL = resolveApiBase(
  process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
);
