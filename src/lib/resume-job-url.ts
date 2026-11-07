/** Exact API sentinel when no posting URL was ever stored. */
export const JOB_URL_NOT_TRACKED = "not tracked";

/** True when value is an http(s) URL (linkable). */
export function isHttpJobUrl(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  return /^https?:\/\//i.test(v);
}

/**
 * Normalize a stored/API jobUrl for display.
 * Missing/blank → "not tracked".
 */
export function normalizeStoredJobUrl(raw: unknown): string {
  if (typeof raw !== "string") return JOB_URL_NOT_TRACKED;
  const trimmed = raw.trim();
  return trimmed || JOB_URL_NOT_TRACKED;
}

/** Read jobUrl / job_url from an API row. */
export function pickStoredJobUrl(row: Record<string, unknown>): string {
  for (const key of ["jobUrl", "job_url"] as const) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return JOB_URL_NOT_TRACKED;
}

/**
 * Value to send on POST /resume/render or /resume/archive.
 * Omit when missing / empty / "not tracked" / not http(s) — do not block save.
 */
export function jobUrlForSave(value: string | null | undefined): string | undefined {
  const v = (value ?? "").trim();
  if (!v) return undefined;
  if (v.toLowerCase() === JOB_URL_NOT_TRACKED) return undefined;
  if (!isHttpJobUrl(v)) return undefined;
  return v;
}
