import { isNetlifyRuntime } from "@/lib/netlify-runtime";
import { RESUME_JOB_TTL_MS, RESUME_JOB_TRIGGER_STALE_MS } from "@/lib/resume-job-constants";
import type { ResumeJobRecord } from "@/lib/resume-generate-prep";

export { RESUME_JOB_TTL_MS, RESUME_JOB_TRIGGER_STALE_MS } from "@/lib/resume-job-constants";

const MEMORY_STORE = new Map<string, ResumeJobRecord>();
const MEMORY_DEDUPE = new Map<string, { jobId: string; expiresAt: number }>();

function dedupeIndexKey(dedupeKey: string): string {
  return `dedupe:${dedupeKey}`;
}

function jobExpiresAt(job: ResumeJobRecord): number {
  return job.expiresAt ?? job.createdAt + RESUME_JOB_TTL_MS;
}

function isExpired(job: ResumeJobRecord): boolean {
  return Date.now() > jobExpiresAt(job);
}

function pruneMemory() {
  const now = Date.now();
  for (const [id, job] of MEMORY_STORE) {
    if (isExpired(job)) MEMORY_STORE.delete(id);
  }
  for (const [key, entry] of MEMORY_DEDUPE) {
    if (entry.expiresAt <= now) MEMORY_DEDUPE.delete(key);
  }
}

async function getBlobStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: "resume-jobs", consistency: "strong" });
}

export function createJobExpiryTimestamp(createdAt = Date.now()): number {
  return createdAt + RESUME_JOB_TTL_MS;
}

export async function linkResumeJobDedupe(dedupeKey: string, jobId: string, expiresAt: number): Promise<void> {
  const entry = { jobId, expiresAt };

  if (isNetlifyRuntime()) {
    const store = await getBlobStore();
    await store.setJSON(dedupeIndexKey(dedupeKey), entry);
    return;
  }

  MEMORY_DEDUPE.set(dedupeKey, entry);
}

export async function clearResumeJobDedupe(dedupeKey?: string): Promise<void> {
  if (!dedupeKey) return;

  if (isNetlifyRuntime()) {
    const store = await getBlobStore();
    await store.delete(dedupeIndexKey(dedupeKey));
    return;
  }

  MEMORY_DEDUPE.delete(dedupeKey);
}

export async function getActiveJobIdForDedupe(dedupeKey: string): Promise<string | null> {
  let entry: { jobId: string; expiresAt: number } | null = null;

  if (isNetlifyRuntime()) {
    const store = await getBlobStore();
    entry = (await store.get(dedupeIndexKey(dedupeKey), { type: "json" })) as {
      jobId: string;
      expiresAt: number;
    } | null;
  } else {
    pruneMemory();
    entry = MEMORY_DEDUPE.get(dedupeKey) ?? null;
  }

  if (!entry || entry.expiresAt <= Date.now()) {
    await clearResumeJobDedupe(dedupeKey);
    return null;
  }

  const job = await getResumeJob(entry.jobId);
  if (!job || job.status !== "pending" || isExpired(job)) {
    await clearResumeJobDedupe(dedupeKey);
    if (job) await deleteResumeJob(entry.jobId, job.dedupeKey);
    return null;
  }

  return entry.jobId;
}

export async function saveResumeJob(jobId: string, job: ResumeJobRecord): Promise<void> {
  if (isNetlifyRuntime()) {
    const store = await getBlobStore();
    await store.setJSON(jobId, job);
    return;
  }

  pruneMemory();
  MEMORY_STORE.set(jobId, job);
}

export async function getResumeJob(jobId: string): Promise<ResumeJobRecord | null> {
  if (isNetlifyRuntime()) {
    const store = await getBlobStore();
    const job = (await store.get(jobId, { type: "json" })) as ResumeJobRecord | null;
    return job ?? null;
  }

  pruneMemory();
  return MEMORY_STORE.get(jobId) ?? null;
}

export async function deleteResumeJob(jobId: string, dedupeKey?: string): Promise<void> {
  if (isNetlifyRuntime()) {
    const store = await getBlobStore();
    await store.delete(jobId);
  } else {
    MEMORY_STORE.delete(jobId);
  }

  await clearResumeJobDedupe(dedupeKey);
}

export type ResumeJobStatusCheck =
  | { kind: "ok"; job: ResumeJobRecord }
  | { kind: "not_found" }
  | { kind: "expired"; message: string }
  | { kind: "stale_trigger"; message: string };

export async function checkResumeJobStatus(jobId: string): Promise<ResumeJobStatusCheck> {
  const job = await getResumeJob(jobId);
  if (!job) {
    return { kind: "not_found" };
  }

  if (isExpired(job)) {
    await deleteResumeJob(jobId, job.dedupeKey);
    return {
      kind: "expired",
      message: "Resume generation expired. Please generate again.",
    };
  }

  if (job.status === "pending") {
    const triggerStale =
      !job.triggerStartedAt && Date.now() - job.createdAt > RESUME_JOB_TRIGGER_STALE_MS;
    if (triggerStale) {
      await saveResumeJob(jobId, {
        ...job,
        status: "error",
        message: "Background worker did not start. Please try again.",
      });
      await clearResumeJobDedupe(job.dedupeKey);
      return {
        kind: "stale_trigger",
        message: "Background worker did not start. Please try again.",
      };
    }
  }

  return { kind: "ok", job };
}
