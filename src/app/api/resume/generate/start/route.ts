import { completeDeepSeek } from "@/lib/deepseek-stream";
import { getServerApiBaseUrl } from "@/lib/api-base-url";
import {
  finalizeResumeContent,
  prepareResumeGeneration,
  type ResumeGenerateRequest,
} from "@/lib/resume-generate-prep";
import { RESUME_MAX_TOKENS } from "@/lib/resume-prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: ResumeGenerateRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const prep = await prepareResumeGeneration(body);
    const base = getServerApiBaseUrl();

    try {
      const upstream = await fetch(`${base}/resume/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: prep.messages }),
        signal: AbortSignal.timeout(8000),
      });

      if (upstream.ok) {
        const data = (await upstream.json()) as { jobId?: string };
        if (data.jobId) {
          return Response.json({
            mode: "async",
            jobId: data.jobId,
            templateName: prep.templateName,
            mergeContext: {
              existingExperiences: prep.existingExperiences,
              headerTitle: prep.headerTitle,
            },
          });
        }
      }
    } catch {
      // Backend unavailable — fall back to local generation (fine for npm run dev).
    }

    const modelText = await completeDeepSeek(prep.messages, RESUME_MAX_TOKENS, {
      jsonObject: true,
    });
    const content = finalizeResumeContent(modelText, {
      existingExperiences: prep.existingExperiences,
      headerTitle: prep.headerTitle,
    });

    return Response.json({
      mode: "sync",
      content,
      templateName: prep.templateName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start resume generation.";
    return Response.json({ error: message }, { status: 500 });
  }
}
