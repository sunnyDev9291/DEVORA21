import { completeDeepSeek } from "@/lib/deepseek-stream";
import type { GeneratedResumeContent, AtsScoreResult } from "@/lib/resume-types";
import {
  buildStrictRecommendations,
  computeStrictAtsScore,
  toAtsScoreResult,
} from "@/lib/resume-ats-algorithm";
import {
  buildKeywordExtractUserPrompt,
  extractHeuristicKeywords,
  KEYWORD_EXTRACT_PROMPT,
  parseKeywordExtractJson,
  type JobKeywords,
} from "@/lib/resume-ats-keywords";

export { ATS_PASS_THRESHOLD } from "@/lib/resume-ats-algorithm";

async function extractJobKeywords(
  jobTitle: string,
  jobDescription: string,
  companyName: string
): Promise<JobKeywords> {
  const heuristic = extractHeuristicKeywords(jobTitle, jobDescription, companyName);

  if (!jobDescription.trim()) return heuristic;

  try {
    const raw = await completeDeepSeek(
      [
        { role: "system", content: KEYWORD_EXTRACT_PROMPT },
        { role: "user", content: buildKeywordExtractUserPrompt(jobTitle, jobDescription, companyName) },
      ],
      2048,
      { jsonObject: true }
    );

    const ai = parseKeywordExtractJson(raw);
    if (!ai) return heuristic;

    return {
      mustHave: ai.mustHave.length > 0 ? ai.mustHave : heuristic.mustHave,
      niceToHave: ai.niceToHave.length > 0 ? ai.niceToHave : heuristic.niceToHave,
      roleKeywords: ai.roleKeywords.length > 0 ? ai.roleKeywords : heuristic.roleKeywords,
      responsibilities: ai.responsibilities.length > 0 ? ai.responsibilities : heuristic.responsibilities,
    };
  } catch {
    return heuristic;
  }
}

/**
 * Strict ATS evaluation: AI extracts JD keywords, deterministic algorithm scores the resume.
 * Score is reproducible — not LLM-guessed.
 */
export async function evaluateStrictAtsScore({
  jobTitle,
  companyName,
  jobDescription,
  content,
}: {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  content: GeneratedResumeContent;
}): Promise<AtsScoreResult> {
  const keywords = await extractJobKeywords(jobTitle, jobDescription, companyName);
  const computation = computeStrictAtsScore(content, jobTitle, keywords);
  const recommendations = buildStrictRecommendations(computation, keywords, content);
  return toAtsScoreResult(computation, recommendations);
}

export function resumeContentToPlainText(content: GeneratedResumeContent): string {
  return [
    content.title,
    content.summary,
    content.skills,
    ...content.experiences.flatMap((exp) => [
      `${exp.role} ${exp.company} ${exp.dates}`,
      ...exp.bullets,
    ]),
  ].join("\n");
}
