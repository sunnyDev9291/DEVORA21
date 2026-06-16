/**
 * `process.env.NETLIFY` is set at Netlify build time but is not reliably
 * available in serverless/Next.js API routes at runtime. Use deploy URL and
 * Netlify-specific runtime signals instead.
 */
export function isNetlifyRuntime(): boolean {
  if (typeof process === "undefined" || !process.env) {
    return false;
  }

  const netlifyGlobal = (globalThis as { Netlify?: unknown }).Netlify;
  if (netlifyGlobal != null) {
    return true;
  }

  if (process.env.NETLIFY_FUNCTIONS_TOKEN) {
    return true;
  }

  const deployUrl = process.env.DEPLOY_PRIME_URL || process.env.URL || "";
  if (/netlify\.(app|com)/i.test(deployUrl)) {
    return true;
  }

  // Build-time fallback (e.g. `netlify build` on CI).
  return process.env.NETLIFY === "true";
}
