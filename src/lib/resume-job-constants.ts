/** How long a pending resume job stays valid in blob storage. */
export const RESUME_JOB_TTL_MS = 30 * 60 * 1000;

/** If a pending job was never acknowledged by the background worker within this window, fail fast. */
export const RESUME_JOB_TRIGGER_STALE_MS = 45 * 1000;
