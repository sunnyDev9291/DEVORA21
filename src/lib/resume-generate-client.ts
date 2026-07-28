import type { GeneratedResumeContent } from "@/lib/resume-types";
import {
  detectResumeGenerationPhase,
  pickResumeModelText,
  RESUME_MAX_TOKENS,
  type ResumeGenerationPhase,
} from "@/lib/resume-prompt";
import { iterateBrowserAiStream } from "@/lib/browser-ai-stream";
import type { ResumeMergeContext } from "@/lib/resume-generate-prep";

export interface ResumeGenerateResult {
  content: GeneratedResumeContent;
  templateName: string;
}

interface PrepareResponse {
  mode?: string;
  templateName?: string;
  messages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  mergeContext?: ResumeMergeContext;
  streamAuthToken?: string;
  error?: string;
}

function previewRawText(text: string, max = 800): string {
  const trimmed = text.trim();
  if (!trimmed) return "(empty)";
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

/**
 * Prepare on Next.js (short), then stream Claude plain text directly from api.devora21.com.
 * No Netlify background job / long Claude proxy.
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
  if (!prep.streamAuthToken?.trim()) {
    throw new Error(
      "Prepare did not return stream auth. Set AI_INTERNAL_API_KEY on the Netlify/Next.js server (server-only, not NEXT_PUBLIC_)."
    );
  }

  handlers.onPhase?.("analyzing");

  let output = "";
  for await (const delta of iterateBrowserAiStream(prep.messages, RESUME_MAX_TOKENS, {
    jsonObject: true,
    signal: handlers.signal,
    authToken: prep.streamAuthToken,
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
