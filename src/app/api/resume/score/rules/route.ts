import { evaluateRuleKeepScore } from "@/lib/resume-rule-keep";
import type { GeneratedResumeContent } from "@/lib/resume-types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RulesScoreRequest {
  content?: GeneratedResumeContent;
  customPrompt?: string;
}

export async function POST(req: Request) {
  let body: RulesScoreRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const content = body.content;
  const customPrompt = body.customPrompt?.trim() ?? "";

  if (!content?.title || !content.summary || !content.skills || !Array.isArray(content.experiences)) {
    return Response.json({ error: "Resume content is required for rule scoring." }, { status: 400 });
  }

  if (!customPrompt) {
    return Response.json({ ruleKeep: null });
  }

  try {
    const ruleKeep = await evaluateRuleKeepScore(content, customPrompt);
    return Response.json({ ruleKeep }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rule scoring failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
