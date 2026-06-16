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

async function markJobError(jobId: string, message: string) {
  const store = getJobStore();
  const job = (await store.get(jobId, { type: "json" })) as ResumeJobRecord | null;
  if (!job || job.status !== "pending") {
    return;
  }

  await store.setJSON(jobId, {
    ...job,
    status: "error",
    message,
  });
}

export default async function handler(req: Request) {
  let jobId = "";

  try {
    const payload = (await req.json()) as { jobId?: string };
    jobId = payload.jobId?.trim() || "";

    if (!jobId) {
      throw new Error("jobId is required.");
    }

    const store = getJobStore();
    const existingJob = (await store.get(jobId, { type: "json" })) as ResumeJobRecord | null;

    if (!existingJob || existingJob.status !== "pending") {
      throw new Error("Resume job not found or already processed.");
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Background generation failed.";
    if (jobId) {
      await markJobError(jobId, message);
    }
    console.error("resume-generate-background failed:", message);
  }
}

export const config: Config = {
  background: true,
};
