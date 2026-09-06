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
import {
  EnglishTeamRequiredError,
  parseEnglishTeamRequired,
} from "@/lib/english-team-gate";

export interface ResumeGenerateResult {
  content: GeneratedResumeContent;
  templateName: string;
}

interface PrepareResponse {
  mode?: string;
  templateName?: string;
  messages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  mergeContext?: ResumeMergeContext;
  /** Server AI_INTERNAL_API_KEY for browser → api.devora21.com stream auth. */
  streamAuthToken?: string;
  error?: string;
  message?: string;
  code?: string;
  answer?: string;
  workWithEnglishTeam?: boolean;
}

function previewRawText(text: string, max = 800): string {
  const trimmed = text.trim();
  if (!trimmed) return "(empty)";
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

/**
 * Prepare on Next.js, then stream Claude directly from the browser → api.devora21.com.
 * Sends userId so the backend can apply the saved profile prompt (system messages are ignored server-side).
 * Always forwards jobTitle + jobDescription on the AI stream for English-team gating.
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
  const jobTitle = typeof body.jobTitle === "string" ? body.jobTitle.trim() : "";
  const jobDescription =
    typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";
  const userApiKey = getUserApiKey();
  const usingUserApiKey = Boolean(userApiKey && isUserApiKey(userApiKey));

  if (!usingUserApiKey && !userId) {
    throw new Error(
      "Authentication required so the profile prompt can be applied. Sign in again, then retry Generate."
    );
  }

  if (!jobTitle && !jobDescription) {
    throw new Error("Job title or job description is required.");
  }

  const prepRes = await fetch("/api/resume/generate/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: handlers.signal,
  });

  const prep = (await prepRes.json()) as PrepareResponse;
  if (!prepRes.ok) {
    const gated = parseEnglishTeamRequired(prep, prepRes.status);
    if (gated) throw gated;
    throw new Error(prep.error || prep.message || `Prepare failed (${prepRes.status}).`);
  }
  if (!prep.messages?.length || !prep.templateName || !prep.mergeContext) {
    throw new Error(
      `Unexpected prepare response from resume generator: ${JSON.stringify(prep).slice(0, 400)}`
    );
  }

  const streamAuthToken = userApiKey || prep.streamAuthToken?.trim() || "";
  if (!streamAuthToken) {
    throw new Error(
      "Missing AI stream auth. Connect a dv21_ API key, or set AI_INTERNAL_API_KEY on the server for cookie sessions."
    );
  }

  handlers.onPhase?.("analyzing");

  let output = "";
  try {
    for await (const delta of iterateBrowserAiStream(prep.messages, RESUME_MAX_TOKENS, {
      jsonObject: true,
      signal: handlers.signal,
      authToken: streamAuthToken,
      userId: userId || undefined,
      jobTitle,
      jobDescription,
    })) {
      if (!delta.content) continue;
      output += delta.content;
      handlers.onOutput?.(delta.content, output);
      handlers.onPhase?.(detectResumeGenerationPhase("", output));
    }
  } catch (err) {
    if (err instanceof EnglishTeamRequiredError) throw err;
    throw err;
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
