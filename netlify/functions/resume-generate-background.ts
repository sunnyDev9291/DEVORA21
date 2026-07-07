import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

type PendingJob = {
  status: "pending";
  templateName: string;
  mergeContext: {
    existingExperiences: unknown[];
    headerTitle: string;
  };
  messages: Array<{ role: "system" | "user"; content: string }>;
  createdAt: number;
  expiresAt: number;
  dedupeKey: string;
  triggerStartedAt?: number;
};

type ResumeJobRecord =
  | PendingJob
  | {
      status: "done";
      templateName: string;
      mergeContext: {
        existingExperiences: unknown[];
        headerTitle: string;
      };
      text: string;
      createdAt: number;
      expiresAt: number;
      dedupeKey: string;
    }
  | {
      status: "error";
      templateName: string;
      mergeContext: {
        existingExperiences: unknown[];
        headerTitle: string;
      };
      message: string;
      createdAt: number;
      expiresAt: number;
      dedupeKey: string;
    };

function getJobStore() {
  return getStore({ name: "resume-jobs", consistency: "strong" });
}

function resolveBackendApiUrl(): string {
  const base = (
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  ).replace(/\/$/, "");
  if (!base) {
    throw new Error("BACKEND_API_URL is not configured on Netlify.");
  }
  return base;
}

function buildAiAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const key = process.env.AI_INTERNAL_API_KEY?.trim();
  if (key) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

async function callAiBackend(messages: unknown[]): Promise<string> {
  const response = await fetch(`${resolveBackendApiUrl()}/ai/chat/completions`, {
    method: "POST",
    headers: buildAiAuthHeaders(),
    body: JSON.stringify({
      messages,
      maxTokens: 16384,
      jsonObject: true,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `AI backend error (${response.status}).`);
  }

  const data = (await response.json()) as { content?: string; error?: string };
  if (data.error) {
    throw new Error(data.error);
  }
  const content = data.content?.trim();
  if (!content) {
    throw new Error("Empty response from AI backend.");
  }
  return content;
}

async function markJobError(jobId: string, job: PendingJob, message: string) {
  const store = getJobStore();
  await store.setJSON(jobId, {
    ...job,
    status: "error",
    message,
  });

  if (job.dedupeKey) {
    await store.delete(`dedupe:${job.dedupeKey}`);
  }
}

export default async function handler(req: Request) {
  let jobId = "";

  try {
    const payload = (await req.json()) as { jobId?: string };
    jobId = payload.jobId?.trim() || "";

    if (!jobId) {
      return new Response(JSON.stringify({ error: "jobId is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const store = getJobStore();
    const existingJob = (await store.get(jobId, { type: "json" })) as ResumeJobRecord | null;

    if (!existingJob) {
      return new Response(JSON.stringify({ error: "Resume job not found." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (existingJob.status === "done") {
      return new Response(JSON.stringify({ ok: true, status: "done" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (existingJob.status === "error") {
      return new Response(JSON.stringify({ ok: true, status: "error" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (Date.now() > existingJob.expiresAt) {
      await markJobError(jobId, existingJob, "Resume generation expired before processing completed.");
      return new Response(JSON.stringify({ error: "Job expired." }), {
        status: 410,
        headers: { "Content-Type": "application/json" },
      });
    }

    const messages = existingJob.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("Resume job is missing AI messages.");
    }

    const text = await callAiBackend(messages);

    await store.setJSON(jobId, {
      ...existingJob,
      status: "done",
      text,
    });

    if (existingJob.dedupeKey) {
      await store.delete(`dedupe:${existingJob.dedupeKey}`);
    }

    return new Response(JSON.stringify({ ok: true, status: "done" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Background generation failed.";
    if (jobId) {
      const store = getJobStore();
      const job = (await store.get(jobId, { type: "json" })) as ResumeJobRecord | null;
      if (job?.status === "pending") {
        await markJobError(jobId, job, message);
      }
    }
    console.error("resume-generate-background failed:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const config: Config = {
  background: true,
};
