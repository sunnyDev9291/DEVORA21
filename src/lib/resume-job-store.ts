import { isNetlifyRuntime } from "@/lib/netlify-runtime";
import type { ResumeJobRecord } from "@/lib/resume-generate-prep";

const MEMORY_STORE = new Map<string, ResumeJobRecord>();
const JOB_TTL_MS = 30 * 60 * 1000;

function pruneMemory() {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of MEMORY_STORE) {
    if (job.createdAt < cutoff) MEMORY_STORE.delete(id);
  }
}

async function getBlobStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: "resume-jobs", consistency: "strong" });
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
    const job = await store.get(jobId, { type: "json" });
    return (job as ResumeJobRecord | null) ?? null;
  }

  pruneMemory();
  return MEMORY_STORE.get(jobId) ?? null;
}

export async function deleteResumeJob(jobId: string): Promise<void> {
  if (isNetlifyRuntime()) {
    const store = await getBlobStore();
    await store.delete(jobId);
    return;
  }

  MEMORY_STORE.delete(jobId);
}
