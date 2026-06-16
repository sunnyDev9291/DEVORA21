import type { BackgroundHandler } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-v4-pro";
const DEEPSEEK_MAX_TOKENS = 16384;

type ResumeJobRecord =
  | {
      status: "pending";
      templateName: string;
      mergeContext: {
        existingExperiences: unknown[];
        headerTitle: string;
      };
      createdAt: number;
    }
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

const handler: BackgroundHandler = async (event) => {
  let jobId = "";
  let existingJob: ResumeJobRecord | null = null;

  try {
    const payload = JSON.parse(event.body || "{}") as {
      jobId?: string;
      messages?: unknown[];
    };

    jobId = payload.jobId || "";
    const messages = payload.messages;

    if (!jobId || !Array.isArray(messages) || messages.length === 0) {
      throw new Error("jobId and messages are required.");
    }

    const store = getStore({ name: "resume-jobs", consistency: "strong" });
    existingJob = (await store.get(jobId, { type: "json" })) as ResumeJobRecord | null;

    if (!existingJob || existingJob.status !== "pending") {
      throw new Error("Resume job not found or already processed.");
    }

    const text = await callDeepSeek(messages);

    await store.setJSON(jobId, {
      ...existingJob,
      status: "done",
      text,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Background generation failed.";

    if (jobId && existingJob?.status === "pending") {
      const store = getStore({ name: "resume-jobs", consistency: "strong" });
      await store.setJSON(jobId, {
        ...existingJob,
        status: "error",
        message,
      });
    }

    console.error("resume-generate-background failed:", message);
  }
};

export default handler;

export const config = {
  type: "experimental_background",
};
