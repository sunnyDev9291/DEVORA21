import { randomUUID } from "crypto";
import {
  prepareResumeGeneration,
  type ResumeGenerateRequest,
} from "@/lib/resume-generate-prep";
import {
  buildResumeNdjsonStream,
  resumeNdjsonResponse,
} from "@/lib/resume-generate-stream";
import { triggerResumeBackgroundWorker } from "@/lib/resume-background-trigger";
import { buildResumeDedupeKey } from "@/lib/resume-job-dedupe";
import { isNetlifyRuntime } from "@/lib/netlify-runtime";
import {
  createJobExpiryTimestamp,
  deleteResumeJob,
  getActiveJobIdForDedupe,
  linkResumeJobDedupe,
  saveResumeJob,
} from "@/lib/resume-job-store";

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
      const dedupeKey = buildResumeDedupeKey(body);
      const existingJobId = await getActiveJobIdForDedupe(dedupeKey);
      if (existingJobId) {
        return Response.json({
          mode: "async",
          jobId: existingJobId,
          templateName: prep.templateName,
          triggered: true,
          reused: true,
        });
      }

      const jobId = randomUUID();
      const createdAt = Date.now();
      const expiresAt = createJobExpiryTimestamp(createdAt);
      const mergeContext = {
        existingExperiences: prep.existingExperiences,
        templateLayout: prep.templateLayout,
        headerTitle: prep.headerTitle,
        customPrompt: prep.customPrompt,
        profileName: prep.profileName,
        skillsSample: prep.skillsSample,
        regenerateBaseline: prep.regenerateBaseline,
      };

      const pendingJob = {
        status: "pending" as const,
        templateName: prep.templateName,
        mergeContext,
        messages: prep.messages,
        createdAt,
        expiresAt,
        dedupeKey,
      };

      await saveResumeJob(jobId, pendingJob);
      await linkResumeJobDedupe(dedupeKey, jobId, expiresAt);

      try {
        await triggerResumeBackgroundWorker(jobId);
        await saveResumeJob(jobId, {
          ...pendingJob,
          triggerStartedAt: Date.now(),
        });
      } catch (triggerErr) {
        await deleteResumeJob(jobId, dedupeKey);
        const message =
          triggerErr instanceof Error
            ? triggerErr.message
            : "Failed to start background resume generation.";
        return Response.json({ error: message }, { status: 502 });
      }

      return Response.json({
        mode: "async",
        jobId,
        templateName: prep.templateName,
        triggered: true,
        reused: false,
      });
    }

    const stream = buildResumeNdjsonStream(prep);
    return resumeNdjsonResponse(stream);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start resume generation.";
    return Response.json({ error: message }, { status: 500 });
  }
}
