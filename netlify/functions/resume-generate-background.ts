import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-v4-pro";
const DEEPSEEK_MAX_TOKENS = 16384;

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

async function callDeepSeek(messages: unknown[]): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set on Netlify.");
  }

  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      max_tokens: DEEPSEEK_MAX_TOKENS,
      stream: false,
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`DeepSeek API error (${response.status}): ${detail || response.statusText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("Empty response from DeepSeek.");
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

    const text = await callDeepSeek(messages);

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
