import { evaluateStrictAtsScore } from "@/lib/resume-ats";
import type { GeneratedResumeContent } from "@/lib/resume-types";

export const runtime = "nodejs";

interface AtsRequest {
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  content?: GeneratedResumeContent;
}

export async function POST(req: Request) {
  let body: AtsRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const jobTitle = body.jobTitle?.trim() ?? "";
  const companyName = body.companyName?.trim() ?? "";
  const jobDescription = body.jobDescription?.trim() ?? "";
  const content = body.content;

  if (!content?.title || !content.summary || !content.skills || !Array.isArray(content.experiences)) {
    return Response.json({ error: "Resume content is required for ATS evaluation." }, { status: 400 });
  }

  if (!jobTitle) {
    return Response.json({ error: "Job title is required." }, { status: 400 });
  }

  if (!companyName) {
    return Response.json({ error: "Company name is required." }, { status: 400 });
  }

  try {
    const result = await evaluateStrictAtsScore({ jobTitle, companyName, jobDescription, content });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ATS evaluation failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
