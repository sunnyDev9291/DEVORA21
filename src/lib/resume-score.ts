import {
  buildStrictRecommendations,
  computeStrictAtsScore,
  toAtsScoreResult,
} from "@/lib/resume-ats-algorithm";
import { evaluateHumanToneScore } from "@/lib/resume-human-tone";
import { getCachedJobKeywords } from "@/lib/resume-keywords-cache";
import { emptyRuleKeepScore, evaluateRuleKeepScore } from "@/lib/resume-rule-keep";
import type {
  AtsScoreResult,
  GeneratedResumeContent,
  HumanToneScoreResult,
  RuleKeepScoreResult,
} from "@/lib/resume-types";

export type ResumeScoreResult = {
  ats: AtsScoreResult;
  humanTone: HumanToneScoreResult;
  ruleKeep: RuleKeepScoreResult;
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
  const humanTone = evaluateHumanToneScore(content);

  return { ats, humanTone, ruleKeep, keywordsCacheKey: cacheKey };
}
