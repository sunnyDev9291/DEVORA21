import {
  prepareResumeGeneration,
  type ResumeGenerateRequest,
} from "@/lib/resume-generate-prep";

export const runtime = "nodejs";

/**
 * Prepare resume prompts + merge context only.
 * Browser streams Claude from api.devora21.com; finalize parses AI JSON.
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
      mode: "direct-stream",
      templateName: prep.templateName,
      messages: prep.messages,
      mergeContext: prep.mergeContext,
      streamAuthToken: process.env.AI_INTERNAL_API_KEY?.trim() || "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to prepare resume generation.";
    return Response.json({ error: message }, { status: 500 });
  }
}
