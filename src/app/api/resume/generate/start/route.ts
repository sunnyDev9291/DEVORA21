import {
  prepareResumeGeneration,
  type ResumeGenerateRequest,
} from "@/lib/resume-generate-prep";

export const runtime = "nodejs";

/**
 * Lightweight prepare for Web UI generate.
 * Returns stream auth + mergeContext only — does NOT invent Claude prompts.
 * Backend /ai/chat/completions/stream builds the prompt from stored template structure.
 */
export async function POST(req: Request) {
  let body: ResumeGenerateRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const prep = await prepareResumeGeneration(body);
    return Response.json({
      mode: "backend-prompt",
      templateName: prep.templateName,
      templateId: prep.templateId,
      // Empty by design — backend ignores FE messages in resume jsonObject mode.
      messages: prep.messages,
      mergeContext: prep.mergeContext,
      task: prep.task,
      streamAuthToken: process.env.AI_INTERNAL_API_KEY?.trim() || "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to prepare resume generation.";
    return Response.json({ error: message }, { status: 500 });
  }
}
