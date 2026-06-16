import { finalizeResumeContent } from "@/lib/resume-generate-prep";
import { deleteResumeJob, getResumeJob } from "@/lib/resume-job-store";

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
    const job = await getResumeJob(jobId);
    if (!job) {
      return Response.json({ error: "Job not found or expired." }, { status: 404 });
    }

    if (job.status === "pending") {
      return Response.json({ status: "pending" });
    }

    if (job.status === "error") {
      await deleteResumeJob(jobId);
      return Response.json({ status: "error", message: job.message });
    }

    const content = finalizeResumeContent(job.text, job.mergeContext);
    await deleteResumeJob(jobId);

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
