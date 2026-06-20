import type { GeneratedResumeContent, AtsScoreResult } from "@/lib/resume-types";
import { getCachedJobKeywords } from "@/lib/resume-keywords-cache";
import { evaluateAtsWithKeywords } from "@/lib/resume-score";

export { ATS_PASS_THRESHOLD, ATS_SCORE_MAX } from "@/lib/resume-ats-algorithm";
export { buildJobKeywordsCacheKey } from "@/lib/resume-keywords-cache";

/**
 * Strict ATS evaluation with cached JD keyword extraction.
 */
export async function evaluateStrictAtsScore({
  jobTitle,
  companyName,
  jobDescription,
  content,
  keywordsCacheKey,
}: {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  content: GeneratedResumeContent;
  keywordsCacheKey?: string;
}): Promise<AtsScoreResult> {
  const { keywords } = await getCachedJobKeywords(
    jobTitle,
    companyName,
    jobDescription,
    keywordsCacheKey ? { cacheKey: keywordsCacheKey } : undefined
  );
  return evaluateAtsWithKeywords(content, jobTitle, keywords);
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
