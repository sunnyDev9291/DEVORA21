import { ATS_SCORE_MAX } from "@/lib/resume-ats-algorithm";
import type { AtsScoreResult, ResumeUnifiedScoreResult, RuleKeepScoreResult } from "@/lib/resume-types";

export const RESUME_SCORE_MAX = 100;
export const RESUME_PASS_THRESHOLD = 94;

export function buildUnifiedResumeScore(
  ats: AtsScoreResult,
  ruleKeep: RuleKeepScoreResult
): ResumeUnifiedScoreResult {
  const hasRules = ruleKeep.totalRules > 0;
  const overall = hasRules ? Math.round((ats.overall + ruleKeep.overall) / 2) : ats.overall;
  const passed = overall >= RESUME_PASS_THRESHOLD;

  let summary: string;
  if (!hasRules) {
    summary =
      overall >= RESUME_PASS_THRESHOLD
        ? `Resume score ${overall}/${RESUME_SCORE_MAX} — ATS evaluation meets the ${RESUME_PASS_THRESHOLD}% target.`
        : ats.summary;
  } else if (passed) {
    summary = `Resume score ${overall}/${RESUME_SCORE_MAX} — ATS (${ats.overall}) and custom rules (${ruleKeep.overall}) meet the ${RESUME_PASS_THRESHOLD}% target.`;
  } else {
    const gaps: string[] = [];
    if (overall < RESUME_PASS_THRESHOLD) gaps.push(`overall ${overall}/${RESUME_SCORE_MAX}`);
    if (!ats.passed) gaps.push(`ATS ${ats.overall}/${ATS_SCORE_MAX}`);
    if (!ruleKeep.passed) {
      gaps.push(`rules ${ruleKeep.passedRules}/${ruleKeep.totalRules} passed`);
    }
    summary = `Resume score ${overall}/${RESUME_SCORE_MAX} — improve ${gaps.join(" and ")}.`;
  }

  return { overall, passed, summary, ats, ruleKeep, hasRules };
}
