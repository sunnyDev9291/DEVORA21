import {
  finalizeResumeContentFromModel,
  type ResumeMergeContext,
} from "@/lib/resume-generate-prep";

export const runtime = "nodejs";

interface FinalizeRequest {
  modelText?: string;
  templateName?: string;
  mergeContext?: ResumeMergeContext;
}

/** Parse/merge streamed model JSON into structured resume content (no AI call). */
export async function POST(req: Request) {
  let body: FinalizeRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const modelText = body.modelText?.trim() ?? "";
  const templateName = body.templateName?.trim() ?? "";
  const mergeContext = body.mergeContext;

  if (!modelText) {
    return Response.json({ error: "modelText is required." }, { status: 400 });
  }
  if (!templateName) {
    return Response.json({ error: "templateName is required." }, { status: 400 });
  }
  if (!mergeContext?.existingExperiences?.length) {
    return Response.json({ error: "mergeContext is required." }, { status: 400 });
  }

  try {
    const content = finalizeResumeContentFromModel(modelText, mergeContext, templateName);
    return Response.json({ content, templateName });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to finalize resume content.";
    const preview =
      modelText.length <= 800 ? modelText : `${modelText.slice(0, 800)}…`;
    return Response.json(
      {
        error: `${message} Raw AI text (preview): ${preview}`,
      },
      { status: 500 }
    );
  }
}
