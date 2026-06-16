import {
  prepareResumeGeneration,
  type ResumeGenerateRequest,
} from "@/lib/resume-generate-prep";
import {
  buildResumeNdjsonStream,
  resumeNdjsonResponse,
} from "@/lib/resume-generate-stream";

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
    return resumeNdjsonResponse(buildResumeNdjsonStream(prep));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate resume content.";
    return Response.json({ error: message }, { status: 500 });
  }
}
