import {
  prepareResumeGeneration,
  finalizeResumeContentFromModel,
  type ResumeGenerateRequest,
} from "@/lib/resume-generate-prep";
import { completeDeepSeek } from "@/lib/deepseek-stream";
import { RESUME_MAX_TOKENS } from "@/lib/resume-prompt";

export const runtime = "nodejs";

/**
 * Legacy sync generate endpoint.
 * Style-only: does not require SUMMARY / SKILLS / EXPERIENCE text headers in the DOCX.
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
    const aiRaw = await completeDeepSeek(prep.messages, RESUME_MAX_TOKENS, {
      jsonObject: true,
    });

    const content = finalizeResumeContentFromModel(aiRaw, {
      existingExperiences: prep.existingExperiences,
      templateLayout: prep.templateLayout,
      headerTitle: prep.headerTitle,
      customPrompt: prep.customPrompt,
      profileName: prep.profileName,
      skillsSample: prep.skillsSample,
      regenerateBaseline: prep.regenerateBaseline,
    }, prep.templateName);

    return Response.json({ content, templateName: prep.templateName });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate resume content.";
    return Response.json({ error: message }, { status: 500 });
  }
}
