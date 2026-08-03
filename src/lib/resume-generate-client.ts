import type { GeneratedResumeContent } from "@/lib/resume-types";
import {
  detectResumeGenerationPhase,
  pickResumeModelText,
  RESUME_MAX_TOKENS,
  type ResumeGenerationPhase,
} from "@/lib/resume-prompt";
import { iterateBrowserAiStream } from "@/lib/browser-ai-stream";
import type { ResumeMergeContext } from "@/lib/resume-generate-prep";
import { getUserApiKey, isUserApiKey } from "@/lib/user-api-key";

export interface ResumeGenerateResult {
  content: GeneratedResumeContent;
  templateName: string;
}

interface PrepareResponse {
  mode?: string;
  templateName?: string;
  messages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  mergeContext?: ResumeMergeContext;
  /** Server AI_INTERNAL_API_KEY for direct-stream fallback / older cached clients. */
  streamAuthToken?: string;
  error?: string;
}

function previewRawText(text: string, max = 800): string {
  const trimmed = text.trim();
  if (!trimmed) return "(empty)";
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

/**
 * Prepare on Next.js, then stream via same-origin BFF → api.devora21.com.
 * Sends userId so the backend can apply the saved profile prompt (system messages are ignored server-side).
 */
export async function generateResume(
  body: Record<string, unknown>,
  handlers: {
    onPhase?: (phase: ResumeGenerationPhase) => void;
    onOutput?: (text: string, full: string) => void;
    signal?: AbortSignal;
  }
): Promise<ResumeGenerateResult> {
  handlers.onPhase?.("starting");

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const userApiKey = getUserApiKey();
  const usingUserApiKey = Boolean(userApiKey && isUserApiKey(userApiKey));

  if (!usingUserApiKey && !userId) {
    throw new Error(
      "Authentication required so the profile prompt can be applied. Sign in again, then retry Generate."
    );
  }

  const prepRes = await fetch("/api/resume/generate/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: handlers.signal,
  });

  const prep = (await prepRes.json()) as PrepareResponse;
  if (!prepRes.ok) {
    throw new Error(prep.error || `Prepare failed (${prepRes.status}).`);
  }
  if (!prep.messages?.length || !prep.templateName || !prep.mergeContext) {
    throw new Error(
      `Unexpected prepare response from resume generator: ${JSON.stringify(prep).slice(0, 400)}`
    );
  }

  const streamAuthToken = userApiKey || prep.streamAuthToken?.trim() || "";
  if (!usingUserApiKey && !streamAuthToken) {
    // BFF can still succeed with server-side AI_INTERNAL_API_KEY; only hard-fail when
    // both are missing after a failed stream attempt would be worse UX — keep soft here.
  }

  handlers.onPhase?.("analyzing");

  let output = "";
  for await (const delta of iterateBrowserAiStream(prep.messages, RESUME_MAX_TOKENS, {
    jsonObject: true,
    signal: handlers.signal,
    // Prefer dv21_ key; else pass prepare token for direct fallback.
    authToken: streamAuthToken || undefined,
    userId: userId || undefined,
  })) {
    if (!delta.content) continue;
    output += delta.content;
    handlers.onOutput?.(delta.content, output);
    handlers.onPhase?.(detectResumeGenerationPhase("", output));
  }

  handlers.onPhase?.("finalizing");

  const modelText = pickResumeModelText(output, "");
  if (!modelText.trim()) {
    throw new Error(
      `AI returned no content after stream. Raw response:\n${previewRawText(output)}`
    );
  }

  const finalizeRes = await fetch("/api/resume/generate/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modelText,
      templateName: prep.templateName,
      mergeContext: prep.mergeContext,
    }),
    signal: handlers.signal,
  });

  const finalized = (await finalizeRes.json().catch(() => null)) as {
    content?: GeneratedResumeContent;
    templateName?: string;
    error?: string;
  } | null;

  if (!finalizeRes.ok) {
    const detail = finalized?.error || `Finalize failed (${finalizeRes.status}).`;
    throw new Error(`${detail}\n\nRaw AI text:\n${previewRawText(modelText)}`);
  }
  if (!finalized?.content || !finalized.templateName) {
    throw new Error(
      `Could not parse streamed AI JSON into resume content.\n\nRaw AI text:\n${previewRawText(modelText)}`
    );
  }

  return { content: finalized.content, templateName: finalized.templateName };
}
