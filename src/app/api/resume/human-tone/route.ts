import { evaluateHumanToneScore } from "@/lib/resume-human-tone";
import type { GeneratedResumeContent } from "@/lib/resume-types";

export const runtime = "nodejs";

interface HumanToneRequest {
  content?: GeneratedResumeContent;
}

export async function POST(req: Request) {
  let body: HumanToneRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const content = body.content;

  if (!content?.title || !content.summary || !content.skills || !Array.isArray(content.experiences)) {
    return Response.json({ error: "Resume content is required for human tone evaluation." }, { status: 400 });
  }

  try {
    const result = evaluateHumanToneScore(content);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Human tone evaluation failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
