import type { GeneratedResumeContent } from "@/lib/resume-types";
import type { ResumeGenerationPhase } from "@/lib/resume-prompt";
import type { ResumeMergeContext } from "@/lib/resume-generate-prep";

export interface ResumeGenerateResult {
  content: GeneratedResumeContent;
  templateName: string;
}

interface StartAsyncResponse {
  mode: "async";
  jobId: string;
  templateName: string;
  mergeContext: ResumeMergeContext;
}

interface StartSyncResponse {
  mode: "sync";
  content: GeneratedResumeContent;
  templateName: string;
}

type StartResponse = StartAsyncResponse | StartSyncResponse;

interface StatusResponse {
  status: "pending" | "done" | "error";
  text?: string;
  message?: string;
}

const POLL_MS = 1500;
const MAX_POLL_MS = 180_000;

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

  const startData = (await startRes.json()) as StartResponse & { error?: string };
  if (!startRes.ok) {
    throw new Error(startData.error || `Request failed (${startRes.status}).`);
  }

  if (startData.mode === "sync") {
    handlers.onPhase?.("finalizing");
    return { content: startData.content, templateName: startData.templateName };
  }

  handlers.onPhase?.("title");

  const deadline = Date.now() + MAX_POLL_MS;
  let phase: ResumeGenerationPhase = "title";

  while (Date.now() < deadline) {
    if (handlers.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const statusRes = await fetch("/api/resume/generate/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: startData.jobId,
        mergeContext: startData.mergeContext,
        templateName: startData.templateName,
      }),
      signal: handlers.signal,
    });

    const statusData = (await statusRes.json()) as StatusResponse & {
      content?: GeneratedResumeContent;
      templateName?: string;
      error?: string;
    };

    if (!statusRes.ok) {
      throw new Error(statusData.error || `Status check failed (${statusRes.status}).`);
    }

    if (statusData.status === "pending") {
      if (phase === "title") {
        phase = "skills";
        handlers.onPhase?.(phase);
      } else if (phase === "skills") {
        phase = "experiences";
        handlers.onPhase?.(phase);
      }
      await sleep(POLL_MS, handlers.signal);
      continue;
    }

    if (statusData.status === "error") {
      throw new Error(statusData.message || "Resume generation failed on backend.");
    }

    if (statusData.status === "done" && statusData.content && statusData.templateName) {
      handlers.onPhase?.("finalizing");
      return { content: statusData.content, templateName: statusData.templateName };
    }

    throw new Error("Unexpected response while generating resume.");
  }

  throw new Error(
    "Resume generation timed out. The AI is still running on the server — try again in a moment or check that the backend is online."
  );
}
