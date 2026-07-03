import { ATS_PASS_THRESHOLD } from "@/lib/resume-ats-algorithm";
import { RULE_KEEP_PASS_THRESHOLD, RULE_KEEP_GUARD_THRESHOLD } from "@/lib/resume-rule-keep-constants";
import { buildUnifiedResumeScore, RESUME_PASS_THRESHOLD, RESUME_SCORE_MAX } from "@/lib/resume-unified-score";
import { keywordPresentInText } from "@/lib/resume-ats-keywords";
import { flattenContentExperienceText } from "@/lib/resume-experience-utils";
import type {
  AtsScoreResult,
  GeneratedResumeContent,
  ResumeUnifiedScoreResult,
  RuleKeepScoreResult,
} from "@/lib/resume-types";

function cloneContent(content: GeneratedResumeContent): GeneratedResumeContent {
  return {
    ...content,
    experiences: content.experiences.map((e) => ({
      ...e,
      bullets: [...e.bullets],
      projects: e.projects?.map((p) => ({ ...p })),
    })),
  };
}

function resumePlainText(content: GeneratedResumeContent): string {
  return [
    content.title,
    content.summary,
    content.skills,
    ...content.experiences.flatMap((e) => [e.role, e.company]),
    ...flattenContentExperienceText(content),
  ].join("\n");
}

/**
 * Surgically inject missing ATS keywords without rewriting bullets or structure.
 * Safe fallback when AI revision regresses the score.
 */
export function applyDeterministicAtsPatches(
  content: GeneratedResumeContent,
  feedback: Pick<AtsScoreResult, "missingKeywords" | "breakdown">,
  options?: { skillsAndTitleOnly?: boolean }
): GeneratedResumeContent {
  const result = cloneContent(content);
  const text = resumePlainText(result);
  const missing = feedback.missingKeywords.filter((k) => !keywordPresentInText(k, text));
  if (missing.length === 0) return result;

  const existingSkills = result.skills
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const toPrepend = missing.filter(
    (k) => !existingSkills.some((s) => keywordPresentInText(k, s))
  );
  if (toPrepend.length > 0) {
    result.skills = [...toPrepend.map((k) => `**${k}**`), ...existingSkills].join(", ");
  }

  const titleParts = result.title
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const kw of missing) {
    if (titleParts.length >= 6) break;
    if (!keywordPresentInText(kw, result.title)) {
      titleParts.push(kw);
    }
  }
  result.title = titleParts.join(" | ");

  if (!options?.skillsAndTitleOnly) {
    const summaryWeak = feedback.breakdown?.find(
      (b) => b.category === "Summary quality" && b.score < b.maxScore * 0.75
    );
    const summaryMissing = missing.find((k) => !keywordPresentInText(k, result.summary));
    if (summaryWeak && summaryMissing) {
      const trimmed = result.summary.trim().replace(/\.$/, "");
      result.summary = `${trimmed}, with proven ${summaryMissing} experience.`;
    }
  }

  return result;
}

export type RegenerateEvaluation = ResumeUnifiedScoreResult;

export type RegeneratePickResult = {
  content: GeneratedResumeContent;
  score: ResumeUnifiedScoreResult;
  notice: string;
};

export const MAX_REGENERATION_ITERATIONS = 6;
export const STALE_REGENERATION_LIMIT = 2;

type ScoredCandidate = {
  content: GeneratedResumeContent;
  ats: AtsScoreResult;
  ruleKeep: RuleKeepScoreResult;
};

type ScoreFloors = {
  ats: number;
  rules: number;
  hasRules: boolean;
  baselineAts: number;
  baselineRules: number;
};

function buildFloors(
  baselineAts: AtsScoreResult,
  baselineRules: RuleKeepScoreResult
): ScoreFloors {
  const baselineAtsScore = baselineAts.overall;
  const baselineRulesScore = baselineRules.overall;
  const hasRules = baselineRules.totalRules > 0;

  return {
    ats: baselineAtsScore >= ATS_PASS_THRESHOLD ? ATS_PASS_THRESHOLD : baselineAtsScore,
    rules: hasRules
      ? baselineRulesScore >= RULE_KEEP_PASS_THRESHOLD
        ? RULE_KEEP_PASS_THRESHOLD
        : baselineRulesScore
      : 0,
    hasRules,
    baselineAts: baselineAtsScore,
    baselineRules: baselineRulesScore,
  };
}

function meetsFloors(candidate: ScoredCandidate, floors: ScoreFloors): boolean {
  if (candidate.ats.overall < floors.ats) return false;
  if (floors.hasRules && candidate.ruleKeep.overall < floors.rules) return false;
  return true;
}

function compositeGain(candidate: ScoredCandidate, floors: ScoreFloors): number {
  let gain = Math.max(0, candidate.ats.overall - floors.ats);
  if (floors.hasRules) {
    gain += Math.max(0, candidate.ruleKeep.overall - floors.rules);
  }
  return gain;
}

function improvementCount(candidate: ScoredCandidate, floors: ScoreFloors): number {
  let count = 0;
  if (candidate.ats.overall > floors.ats) count++;
  if (floors.hasRules && candidate.ruleKeep.overall > floors.rules) count++;
  return count;
}

function failingDimensionGain(candidate: ScoredCandidate, floors: ScoreFloors): number {
  const baselineUnified = floors.hasRules
    ? Math.round((floors.baselineAts + floors.baselineRules) / 2)
    : floors.baselineAts;
  if (baselineUnified >= RESUME_PASS_THRESHOLD) return 0;
  return buildUnifiedResumeScore(candidate.ats, candidate.ruleKeep).overall - baselineUnified;
}

function meetsCriterionBaselines(candidate: ScoredCandidate, baseline: ScoredCandidate): boolean {
  if (candidate.ats.overall < baseline.ats.overall) return false;
  if (candidate.ruleKeep.overall < baseline.ruleKeep.overall) return false;

  for (const baseItem of baseline.ats.breakdown) {
    const candItem = candidate.ats.breakdown.find((b) => b.category === baseItem.category);
    if (candItem && candItem.score < baseItem.score) return false;
  }

  for (const baseRule of baseline.ruleKeep.rules) {
    const candRule = candidate.ruleKeep.rules.find((r) => r.id === baseRule.id);
    if (baseRule.passed && candRule && !candRule.passed) return false;
  }

  return true;
}

function meetsStrictBaselines(candidate: ScoredCandidate, floors: ScoreFloors): boolean {
  if (candidate.ats.overall < floors.baselineAts) return false;
  if (floors.hasRules && candidate.ruleKeep.overall < floors.baselineRules) return false;
  return true;
}

function passingDimensionLoss(candidate: ScoredCandidate, floors: ScoreFloors): number {
  let loss = 0;
  if (floors.baselineAts >= ATS_PASS_THRESHOLD && candidate.ats.overall < floors.baselineAts) {
    loss += floors.baselineAts - candidate.ats.overall;
  }
  if (floors.hasRules && candidate.ruleKeep.overall < floors.baselineRules) {
    loss += floors.baselineRules - candidate.ruleKeep.overall;
  }
  return loss;
}

function acceptableCandidate(
  candidate: ScoredCandidate,
  floors: ScoreFloors,
  baseline: ScoredCandidate
): boolean {
  if (!meetsCriterionBaselines(candidate, baseline)) return false;
  if (floors.hasRules && candidate.ruleKeep.overall < floors.baselineRules) return false;
  if (!meetsFloors(candidate, floors)) return false;
  if (meetsStrictBaselines(candidate, floors)) return true;

  const gain = failingDimensionGain(candidate, floors);
  const loss = passingDimensionLoss(candidate, floors);
  return gain > 0 && gain > loss;
}

function needsImprovement(
  ats: AtsScoreResult,
  rules: RuleKeepScoreResult
): boolean {
  return buildUnifiedResumeScore(ats, rules).overall < RESUME_PASS_THRESHOLD;
}

function shouldAcceptCandidate(
  candidate: ScoredCandidate,
  baseline: ScoredCandidate,
  floors: ScoreFloors
): boolean {
  if (!acceptableCandidate(candidate, floors, baseline)) return false;
  if (!isBetterCandidate(candidate, baseline, floors)) return false;

  const baselineNeedsWork = needsImprovement(baseline.ats, baseline.ruleKeep);
  if (!baselineNeedsWork) return true;

  return failingDimensionGain(candidate, floors) > 0 || improvementCount(candidate, floors) > 0;
}

function isBetterCandidate(a: ScoredCandidate, b: ScoredCandidate, floors: ScoreFloors): boolean {
  const aStrict = meetsStrictBaselines(a, floors);
  const bStrict = meetsStrictBaselines(b, floors);
  if (aStrict && !bStrict) return true;
  if (!aStrict && bStrict) return false;

  const aOk = meetsFloors(a, floors);
  const bOk = meetsFloors(b, floors);
  if (aOk && !bOk) return true;
  if (!aOk && bOk) return false;

  const aGain = compositeGain(a, floors);
  const bGain = compositeGain(b, floors);
  if (aGain !== bGain) return aGain > bGain;

  const aImproved = improvementCount(a, floors);
  const bImproved = improvementCount(b, floors);
  if (aImproved !== bImproved) return aImproved > bImproved;

  const aSum = a.ats.overall + (floors.hasRules ? a.ruleKeep.overall : 0);
  const bSum = b.ats.overall + (floors.hasRules ? b.ruleKeep.overall : 0);
  return aSum > bSum;
}

function formatScoreNotice(label: string, before: number, after: number): string {
  if (after > before) return `${label} ${before} → ${after}`;
  if (after < before) return `${label} ${before} → ${after} (dropped)`;
  return `${label} held at ${after}`;
}

function buildImprovementNotice(
  floors: ScoreFloors,
  best: ScoredCandidate,
  restored: boolean
): string {
  const atsPart = formatScoreNotice("ATS", floors.baselineAts, best.ats.overall);
  const rulesPart = floors.hasRules
    ? formatScoreNotice("Rules", floors.baselineRules, best.ruleKeep.overall)
    : null;
  const scoreParts = [atsPart, rulesPart].filter(Boolean).join("; ");

  if (restored) {
    return `Regeneration did not improve weak scores enough. Restored previous draft (${scoreParts}).`;
  }

  const improved =
    improvementCount(best, floors) > 0 || failingDimensionGain(best, floors) > 0;
  if (improved) {
    return `Scores updated — ${scoreParts}.`;
  }
  return `Scores held — ${scoreParts}.`;
}

function pickResult(
  candidate: ScoredCandidate,
  floors: ScoreFloors,
  restored: boolean
): RegeneratePickResult {
  return {
    content: candidate.content,
    score: buildUnifiedResumeScore(candidate.ats, candidate.ruleKeep),
    notice: buildImprovementNotice(floors, candidate, restored),
  };
}

function contentKey(content: GeneratedResumeContent): string {
  return JSON.stringify(content);
}

function buildDeterministicCandidates(
  baseline: GeneratedResumeContent,
  aiDraft: GeneratedResumeContent,
  baselineAts: AtsScoreResult,
  baselineRules: RuleKeepScoreResult,
  aiAts: AtsScoreResult
): GeneratedResumeContent[] {
  const rulesGuarded =
    baselineRules.totalRules > 0 && baselineRules.overall >= RULE_KEEP_GUARD_THRESHOLD;
  const atsOpts = rulesGuarded ? { skillsAndTitleOnly: true as const } : undefined;

  const seen = new Set<string>();
  const out: GeneratedResumeContent[] = [];

  function add(content: GeneratedResumeContent) {
    const key = contentKey(content);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(content);
  }

  if (rulesGuarded) {
    add(applyDeterministicAtsPatches(baseline, baselineAts, atsOpts));
    return out;
  }

  add(applyDeterministicAtsPatches(baseline, baselineAts, atsOpts));
  if (!rulesGuarded) {
    add(aiDraft);
    if (aiAts.missingKeywords.length > 0) {
      add(applyDeterministicAtsPatches(aiDraft, aiAts));
    }
  }

  return out;
}

/**
 * After AI regenerate, score surgical patch candidates and prefer drafts that improve
 * weak dimensions without trading away already-strong scores.
 */
export async function pickBestRegenerateResult(
  baseline: GeneratedResumeContent,
  baselineAts: AtsScoreResult,
  baselineRules: RuleKeepScoreResult,
  aiDraft: GeneratedResumeContent,
  evaluate: (content: GeneratedResumeContent) => Promise<RegenerateEvaluation | null>
): Promise<RegeneratePickResult> {
  const floors = buildFloors(baselineAts, baselineRules);

  const baselineCandidate: ScoredCandidate = {
    content: baseline,
    ats: baselineAts,
    ruleKeep: baselineRules,
  };

  const aiEval = await evaluate(aiDraft);
  if (!aiEval) {
    return {
      content: baseline,
      score: buildUnifiedResumeScore(baselineAts, baselineRules),
      notice: "Could not re-score the revision. Kept your previous draft.",
    };
  }

  let best: ScoredCandidate = baselineCandidate;

  const aiScored: ScoredCandidate = {
    content: aiDraft,
    ats: aiEval.ats,
    ruleKeep: aiEval.ruleKeep,
  };

  const rulesGuarded =
    baselineRules.totalRules > 0 && baselineRules.overall >= RULE_KEEP_GUARD_THRESHOLD;

  if (
    !rulesGuarded &&
    acceptableCandidate(aiScored, floors, baselineCandidate) &&
    isBetterCandidate(aiScored, best, floors)
  ) {
    best = aiScored;
  }

  const candidates = buildDeterministicCandidates(
    baseline,
    aiDraft,
    baselineAts,
    baselineRules,
    aiEval.ats
  );

  for (const content of candidates) {
    if (contentKey(content) === contentKey(aiDraft)) continue;

    const candidateEval = await evaluate(content);
    if (!candidateEval) continue;

    const scored: ScoredCandidate = {
      content,
      ats: candidateEval.ats,
      ruleKeep: candidateEval.ruleKeep,
    };

    if (acceptableCandidate(scored, floors, baselineCandidate) && isBetterCandidate(scored, best, floors)) {
      best = scored;
    }
  }

  if (shouldAcceptCandidate(best, baselineCandidate, floors)) {
    const usedPatch = best.content !== aiDraft;
    if (usedPatch) {
      const atsPart = formatScoreNotice("ATS", floors.baselineAts, best.ats.overall);
      const rulesPart = floors.hasRules
        ? formatScoreNotice("Rules", floors.baselineRules, best.ruleKeep.overall)
        : null;
      const scoreParts = [atsPart, rulesPart].filter(Boolean).join("; ");
      return {
        ...pickResult(best, floors, false),
        notice: `Applied surgical fixes instead of a broad rewrite — ${scoreParts}.`,
      };
    }
    return pickResult(best, floors, false);
  }

  return {
    ...pickResult(baselineCandidate, floors, true),
    notice: buildImprovementNotice(
      floors,
      {
        content: aiDraft,
        ats: aiEval.ats,
        ruleKeep: aiEval.ruleKeep,
      },
      true
    ),
  };
}

export type IterativeRegenerationInput = {
  baselineContent: GeneratedResumeContent;
  baselineAts: AtsScoreResult;
  baselineRules: RuleKeepScoreResult;
  generateDraft: (input: {
    previousContent: GeneratedResumeContent;
    atsFeedback: AtsScoreResult;
    ruleKeepFeedback: RuleKeepScoreResult;
  }) => Promise<GeneratedResumeContent>;
  evaluate: (content: GeneratedResumeContent) => Promise<RegenerateEvaluation | null>;
};

/**
 * Run regeneration iterations until overall score ≥ 94, or two consecutive iterations
 * with no overall score improvement.
 */
export async function runIterativeRegeneration(
  input: IterativeRegenerationInput
): Promise<RegeneratePickResult> {
  let content = input.baselineContent;
  let ats = input.baselineAts;
  let rules = input.baselineRules;
  let score = buildUnifiedResumeScore(ats, rules);
  let lastOverall = score.overall;
  let staleIterations = 0;

  let best: RegeneratePickResult = {
    content,
    score,
    notice: `Starting from overall score ${score.overall}/${RESUME_SCORE_MAX} (target ≥ ${RESUME_PASS_THRESHOLD}).`,
  };

  if (score.overall >= RESUME_PASS_THRESHOLD) {
    return {
      ...best,
      notice: `Already at target — overall score ${score.overall} (≥ ${RESUME_PASS_THRESHOLD}).`,
    };
  }

  for (let iteration = 0; iteration < MAX_REGENERATION_ITERATIONS; iteration += 1) {
    const aiDraft = await input.generateDraft({
      previousContent: content,
      atsFeedback: ats,
      ruleKeepFeedback: rules,
    });

    const picked = await pickBestRegenerateResult(content, ats, rules, aiDraft, input.evaluate);

    if (picked.score.overall > lastOverall) {
      staleIterations = 0;
      content = picked.content;
      ats = picked.score.ats;
      rules = picked.score.ruleKeep;
      score = picked.score;
      lastOverall = score.overall;
      best = picked;

      if (score.overall >= RESUME_PASS_THRESHOLD) {
        return {
          ...best,
          notice: `${picked.notice} Target reached — overall score ${score.overall} (≥ ${RESUME_PASS_THRESHOLD}).`,
        };
      }
      continue;
    }

    staleIterations += 1;
    if (staleIterations >= STALE_REGENERATION_LIMIT) {
      return {
        ...best,
        notice: `${best.notice} Stopped after ${STALE_REGENERATION_LIMIT} iterations with no overall score gain (best: ${best.score.overall}).`,
      };
    }
  }

  return {
    ...best,
    notice: `${best.notice} Reached iteration limit (best overall: ${best.score.overall}).`,
  };
}
