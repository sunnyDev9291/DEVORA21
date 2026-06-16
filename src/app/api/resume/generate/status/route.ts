import { getServerApiBaseUrl } from "@/lib/api-base-url";
import {
  finalizeResumeContent,
  type ResumeMergeContext,
} from "@/lib/resume-generate-prep";

export const runtime = "nodejs";

interface StatusRequest {
  jobId?: string;
  mergeContext?: ResumeMergeContext;
  templateName?: string;
}

export async function POST(req: Request) {
  let body: StatusRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const jobId = body.jobId?.trim();
  const mergeContext = body.mergeContext;
  const templateName = body.templateName?.trim();

  if (!jobId) {
    return Response.json({ error: "jobId is required." }, { status: 400 });
  }
  if (!mergeContext?.existingExperiences?.length || !templateName) {
    return Response.json({ error: "mergeContext and templateName are required." }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${getServerApiBaseUrl()}/resume/generate/${encodeURIComponent(jobId)}`, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });

    const data = (await upstream.json()) as {
      status?: string;
      text?: string;
      message?: string;
      error?: string;
    };

    if (!upstream.ok) {
      return Response.json(
        { error: data.error || data.message || "Backend status check failed." },
        { status: upstream.status }
      );
    }

    if (data.status === "pending") {
      return Response.json({ status: "pending" });
    }

    if (data.status === "error") {
      return Response.json({ status: "error", message: data.message || "Generation failed." });
    }

    if (data.status === "done" && data.text) {
      const content = finalizeResumeContent(data.text, mergeContext);
      return Response.json({ status: "done", content, templateName });
    }

    return Response.json({ error: "Unexpected backend response." }, { status: 502 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to check generation status.";
    return Response.json({ error: message }, { status: 502 });
  }
}
