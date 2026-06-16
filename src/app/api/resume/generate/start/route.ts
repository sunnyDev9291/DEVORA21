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

function getSiteUrl(): string {
  return (
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:8888"
  );
}

async function triggerBackgroundJob(jobId: string, messages: unknown[]) {
  const response = await fetch(`${getSiteUrl()}/.netlify/functions/resume-generate-background`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, messages }),
  });

  if (response.status !== 202 && !response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Failed to start background generation (${response.status}).`);
  }
}

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
        createdAt: Date.now(),
      });

      await triggerBackgroundJob(jobId, prep.messages);

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
