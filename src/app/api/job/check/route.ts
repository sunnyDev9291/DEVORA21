import { analyzeJobCheck } from "@/lib/job-check";
import type { JobCheckRequest } from "@/lib/job-check-types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: JobCheckRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const companyName = body.companyName?.trim() ?? "";
  if (!companyName) {
    return Response.json({ error: "Company name is required." }, { status: 400 });
  }

  try {
    const result = await analyzeJobCheck({
      jobTitle: body.jobTitle?.trim() ?? "",
      companyName,
      jobDescription: body.jobDescription?.trim() ?? "",
      userId: body.userId?.trim(),
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Job Check failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
