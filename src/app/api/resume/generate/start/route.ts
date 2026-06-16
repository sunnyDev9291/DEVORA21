import { randomUUID } from "crypto";
import {
  prepareResumeGeneration,
  type ResumeGenerateRequest,
} from "@/lib/resume-generate-prep";
import {
  buildResumeNdjsonStream,
  resumeNdjsonResponse,
} from "@/lib/resume-generate-stream";
import { isNetlifyRuntime } from "@/lib/netlify-runtime";
import { saveResumeJob } from "@/lib/resume-job-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: ResumeGenerateRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const prep = await prepareResumeGeneration(body);

    if (isNetlifyRuntime()) {
      const jobId = randomUUID();
      const mergeContext = {
        existingExperiences: prep.existingExperiences,
        headerTitle: prep.headerTitle,
      };

      await saveResumeJob(jobId, {
        status: "pending",
        templateName: prep.templateName,
        mergeContext,
        messages: prep.messages,
        createdAt: Date.now(),
      });

      return Response.json({
        mode: "async",
        jobId,
        templateName: prep.templateName,
        mergeContext,
      });
    }

    const stream = buildResumeNdjsonStream(prep);
    return resumeNdjsonResponse(stream);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start resume generation.";
    return Response.json({ error: message }, { status: 500 });
  }
}
