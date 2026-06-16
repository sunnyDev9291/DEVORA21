/** Server-side backend URL (HTTP is fine — called from Next.js, not the browser). */
export function getServerApiBaseUrl(): string {
  return (
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://31.44.7.64:5000"
  );
}

/** Browser-safe auth base URL — always same-origin to avoid mixed-content blocks on HTTPS. */
export function getClientAuthBaseUrl(): string {
  if (typeof window !== "undefined") return "/api/auth";
  return `${getServerApiBaseUrl()}/auth`;
}
