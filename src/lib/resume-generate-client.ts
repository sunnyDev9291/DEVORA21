import type { GeneratedResumeContent } from "@/lib/resume-types";
import type { ResumeGenerationPhase } from "@/lib/resume-prompt";
import { consumeResumeStream } from "@/lib/resume-stream-client";

export interface ResumeGenerateResult {
  content: GeneratedResumeContent;
  templateName: string;
}

interface StartAsyncResponse {
  mode: "async";
  jobId: string;
  templateName: string;
}

const POLL_MS = 1500;
const MAX_POLL_MS = 15 * 60 * 1000;
const RUN_PATH = "/.netlify/functions/resume-generate-background";

async function triggerResumeBackgroundJob(jobId: string, signal?: AbortSignal) {
  const response = await fetch(RUN_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId }),
    signal,
  });

  if (response.status !== 202 && !response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Failed to start background generation (${response.status}).`);
  }
}
const POLL_PHASES: ResumeGenerationPhase[] = [
  "starting",
  "analyzing",
  "title",
  "summary",
  "skills",
  "experiences",
];

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

async function pollResumeJob(
  jobId: string,
  handlers: {
    onPhase?: (phase: ResumeGenerationPhase) => void;
    signal?: AbortSignal;
  }
): Promise<ResumeGenerateResult> {
  const deadline = Date.now() + MAX_POLL_MS;
  let phaseIndex = 0;
  handlers.onPhase?.(POLL_PHASES[phaseIndex]);

  while (Date.now() < deadline) {
    if (handlers.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const statusRes = await fetch("/api/resume/generate/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
      signal: handlers.signal,
    });

    const statusData = (await statusRes.json()) as {
      status?: string;
      content?: GeneratedResumeContent;
      templateName?: string;
      message?: string;
      error?: string;
    };

    if (!statusRes.ok) {
      throw new Error(statusData.error || `Status check failed (${statusRes.status}).`);
    }

    if (statusData.status === "pending") {
      if (phaseIndex < POLL_PHASES.length - 1) {
        phaseIndex += 1;
        handlers.onPhase?.(POLL_PHASES[phaseIndex]);
      }
      await sleep(POLL_MS, handlers.signal);
      continue;
    }

    if (statusData.status === "error") {
      throw new Error(statusData.message || "Resume generation failed.");
    }

    if (statusData.status === "done" && statusData.content && statusData.templateName) {
      handlers.onPhase?.("finalizing");
      return { content: statusData.content, templateName: statusData.templateName };
    }

    throw new Error("Unexpected response while generating resume.");
  }

  throw new Error("Resume generation timed out. Please try again.");
}

export async function generateResume(
  body: Record<string, unknown>,
  handlers: {
    onPhase?: (phase: ResumeGenerationPhase) => void;
    signal?: AbortSignal;
  }
): Promise<ResumeGenerateResult> {
  const startRes = await fetch("/api/resume/generate/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: handlers.signal,
  });

  const contentType = startRes.headers.get("content-type") ?? "";

  if (contentType.includes("ndjson")) {
    return consumeResumeStream(startRes, handlers);
  }

  const startData = (await startRes.json()) as StartAsyncResponse & { error?: string };
  if (!startRes.ok) {
    throw new Error(startData.error || `Request failed (${startRes.status}).`);
  }

  if (startData.mode !== "async" || !startData.jobId) {
    throw new Error("Unexpected response from resume generator.");
  }

  await triggerResumeBackgroundJob(startData.jobId, handlers.signal);
  return pollResumeJob(startData.jobId, handlers);
}
