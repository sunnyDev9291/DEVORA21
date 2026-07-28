import {
  prepareResumeGeneration,
  type ResumeGenerateRequest,
  type ResumeMergeContext,
} from "@/lib/resume-generate-prep";

export const runtime = "nodejs";

/**
 * Prepare resume prompts + merge context only.
 * The browser streams Claude directly from api.devora21.com (no Netlify AI proxy).
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
    const mergeContext: ResumeMergeContext = {
      existingExperiences: prep.existingExperiences,
      templateLayout: prep.templateLayout,
      headerTitle: prep.headerTitle,
      customPrompt: prep.customPrompt,
      profileName: prep.profileName,
      skillsSample: prep.skillsSample,
      regenerateBaseline: prep.regenerateBaseline,
    };

    return Response.json({
      mode: "direct-stream",
      templateName: prep.templateName,
      messages: prep.messages,
      mergeContext,
      // Runtime-only auth for browser → api.devora21.com stream.
      // Kept off NEXT_PUBLIC_* so Netlify secrets scanning does not fail the build.
      streamAuthToken: process.env.AI_INTERNAL_API_KEY?.trim() || "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to prepare resume generation.";
    return Response.json({ error: message }, { status: 500 });
  }
}
