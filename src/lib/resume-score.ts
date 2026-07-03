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
  RuleKeepScoreResult,
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
  skipRuleKeep,
  cachedRuleKeep,
}: {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  content: GeneratedResumeContent;
  keywordsCacheKey?: string;
  customPrompt?: string;
  /** Skip slow rule-audit AI — reuse {@link cachedRuleKeep} (ATS-only optimization passes). */
  skipRuleKeep?: boolean;
  cachedRuleKeep?: RuleKeepScoreResult;
}): Promise<ResumeScoreResult> {
  const prompt = customPrompt?.trim() ?? "";
  const atsOnly = skipRuleKeep !== false;

  const [{ keywords, cacheKey }, ruleKeep] = await Promise.all([
    getCachedJobKeywords(
      jobTitle,
      companyName,
      jobDescription,
      keywordsCacheKey
        ? { cacheKey: keywordsCacheKey, heuristicOnMiss: true }
        : undefined
    ),
    atsOnly
      ? Promise.resolve(cachedRuleKeep ?? emptyRuleKeepScore())
      : prompt
        ? evaluateRuleKeepScore(content, prompt)
        : Promise.resolve(emptyRuleKeepScore()),
  ]);

  const ats = evaluateAtsWithKeywords(content, jobTitle, keywords);

  return { ...buildUnifiedResumeScore(ats, ruleKeep), keywordsCacheKey: cacheKey };
}

/** Rule Keep audit only — run separately to avoid gateway timeouts on the main score route. */
export async function evaluateRuleKeepScoreBundle(
  content: GeneratedResumeContent,
  customPrompt: string
): Promise<RuleKeepScoreResult> {
  const prompt = customPrompt.trim();
  if (!prompt) return emptyRuleKeepScore();
  return evaluateRuleKeepScore(content, prompt);
}
