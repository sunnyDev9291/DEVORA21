import {
  buildStrictRecommendations,
  computeStrictAtsScore,
  toAtsScoreResult,
} from "@/lib/resume-ats-algorithm";
import { getCachedJobKeywords } from "@/lib/resume-keywords-cache";
import { emptyRuleKeepScore, evaluateRuleKeepScore } from "@/lib/resume-rule-keep";
import { buildUnifiedResumeScore } from "@/lib/resume-unified-score";
import type {
  AtsScoreResult,
  GeneratedResumeContent,
  ResumeUnifiedScoreResult,
} from "@/lib/resume-types";

export type ResumeScoreResult = ResumeUnifiedScoreResult & {
  keywordsCacheKey: string;
};

export function evaluateAtsWithKeywords(
  content: GeneratedResumeContent,
  jobTitle: string,
  keywords: Parameters<typeof computeStrictAtsScore>[2]
): AtsScoreResult {
  const computation = computeStrictAtsScore(content, jobTitle, keywords);
  const recommendations = buildStrictRecommendations(computation, keywords, content);
  return toAtsScoreResult(computation, recommendations);
}

export async function evaluateResumeScoreBundle({
  jobTitle,
  companyName,
  jobDescription,
  content,
  keywordsCacheKey,
  customPrompt,
}: {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  content: GeneratedResumeContent;
  keywordsCacheKey?: string;
  customPrompt?: string;
}): Promise<ResumeScoreResult> {
  const prompt = customPrompt?.trim() ?? "";

  const [{ keywords, cacheKey }, ruleKeep] = await Promise.all([
    getCachedJobKeywords(
      jobTitle,
      companyName,
      jobDescription,
      keywordsCacheKey ? { cacheKey: keywordsCacheKey } : undefined
    ),
    prompt ? evaluateRuleKeepScore(content, prompt) : Promise.resolve(emptyRuleKeepScore()),
  ]);

  const ats = evaluateAtsWithKeywords(content, jobTitle, keywords);

  return { ...buildUnifiedResumeScore(ats, ruleKeep), keywordsCacheKey: cacheKey };
}
