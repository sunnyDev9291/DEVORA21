/** Exact API sentinel when no posting URL was ever stored. */
export const JOB_URL_NOT_TRACKED = "not tracked";

/** Exact API sentinel when platform could not be derived from jobUrl. */
export const JOB_PLATFORM_NOT_TRACKED = "not tracked";

/**
 * Known API platform labels (API fills these from jobUrl — never send/edit from the client).
 * Built In, Hiring Cafe, Workable, Working Nomad, Himalayas, JobGether,
 * LinkedIn Easy Apply, Jobicy, Get On Board, LinkedIn Company Apply, "not tracked".
 */
export const KNOWN_JOB_PLATFORMS = [
  "Built In",
  "Hiring Cafe",
  "Workable",
  "Working Nomad",
  "Himalayas",
  "JobGether",
  "LinkedIn Easy Apply",
  "Jobicy",
  "Get On Board",
  "LinkedIn Company Apply",
  JOB_PLATFORM_NOT_TRACKED,
] as const;

/** True when value is an http(s) URL (copyable). */
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

/** Normalize API platform for display. Missing/blank → "not tracked". */
export function normalizeStoredPlatform(raw: unknown): string {
  if (typeof raw !== "string") return JOB_PLATFORM_NOT_TRACKED;
  const trimmed = raw.trim();
  return trimmed || JOB_PLATFORM_NOT_TRACKED;
}

/** Read jobUrl / job_url from an API row. */
export function pickStoredJobUrl(row: Record<string, unknown>): string {
  for (const key of ["jobUrl", "job_url"] as const) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return JOB_URL_NOT_TRACKED;
}

/** Read platform from an API row (API-owned; never send from the client). */
export function pickStoredPlatform(row: Record<string, unknown>): string {
  const value = row.platform;
  if (typeof value === "string" && value.trim()) return value.trim();
  return JOB_PLATFORM_NOT_TRACKED;
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
