import { finalizeResumeContent } from "@/lib/resume-generate-prep";
import { checkResumeJobStatus, deleteResumeJob } from "@/lib/resume-job-store";

export const runtime = "nodejs";

interface StatusRequest {
  jobId?: string;
}

export async function POST(req: Request) {
  let body: StatusRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const jobId = body.jobId?.trim();
  if (!jobId) {
    return Response.json({ error: "jobId is required." }, { status: 400 });
  }

  try {
    const check = await checkResumeJobStatus(jobId);

    if (check.kind === "not_found") {
      return Response.json({ error: "Job not found or expired." }, { status: 404 });
    }

    if (check.kind === "expired" || check.kind === "stale_trigger") {
      return Response.json({ status: "error", message: check.message });
    }

    const job = check.job;

    if (job.status === "pending") {
      return Response.json({ status: "pending" });
    }

    if (job.status === "error") {
      await deleteResumeJob(jobId, job.dedupeKey);
      return Response.json({ status: "error", message: job.message });
    }

    const content = finalizeResumeContent(job.text, job.mergeContext);
    await deleteResumeJob(jobId, job.dedupeKey);

    return Response.json({
      status: "done",
      content,
      templateName: job.templateName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to check generation status.";
    return Response.json({ error: message }, { status: 500 });
  }
}
