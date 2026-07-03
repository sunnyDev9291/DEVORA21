import { evaluateResumeScoreBundle } from "@/lib/resume-score";
import type { GeneratedResumeContent, RuleKeepScoreResult } from "@/lib/resume-types";

export const runtime = "nodejs";
export const maxDuration = 26;

interface ScoreRequest {
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  content?: GeneratedResumeContent;
  /** Reuse cached JD keywords — no AI keyword extraction. */
  keywordsCacheKey?: string;
  customPrompt?: string;
  /** ATS-only by default. Set false to run Rule Keep in the same request (slow). */
  skipRuleKeep?: boolean;
  cachedRuleKeep?: RuleKeepScoreResult;
}

export async function POST(req: Request) {
  let body: ScoreRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const jobTitle = body.jobTitle?.trim() ?? "";
  const companyName = body.companyName?.trim() ?? "";
  const jobDescription = body.jobDescription?.trim() ?? "";
  const content = body.content;
  const keywordsCacheKey = body.keywordsCacheKey?.trim() || undefined;

  if (!content?.title || !content.summary || !content.skills || !Array.isArray(content.experiences)) {
    return Response.json({ error: "Resume content is required for scoring." }, { status: 400 });
  }

  if (!jobTitle) {
    return Response.json({ error: "Job title is required." }, { status: 400 });
  }

  if (!companyName) {
    return Response.json({ error: "Company name is required." }, { status: 400 });
  }

  try {
    const result = await evaluateResumeScoreBundle({
      jobTitle,
      companyName,
      jobDescription,
      content,
      keywordsCacheKey,
      customPrompt: body.customPrompt,
      skipRuleKeep: body.skipRuleKeep !== false,
      cachedRuleKeep: body.cachedRuleKeep,
    });

    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Resume scoring failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}