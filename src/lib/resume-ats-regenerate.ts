import { ATS_PASS_THRESHOLD } from "@/lib/resume-ats-algorithm";
import { HUMAN_TONE_PASS_THRESHOLD } from "@/lib/resume-human-tone-algorithm";
import { RULE_KEEP_PASS_THRESHOLD } from "@/lib/resume-rule-keep-constants";
import { keywordPresentInText } from "@/lib/resume-ats-keywords";
import type {
  AtsScoreResult,
  GeneratedResumeContent,
  HumanToneScoreResult,
  RuleKeepScoreResult,
} from "@/lib/resume-types";

function cloneContent(content: GeneratedResumeContent): GeneratedResumeContent {
  return {
    ...content,
    experiences: content.experiences.map((e) => ({
      ...e,
      bullets: [...e.bullets],
    })),
  };
}

function resumePlainText(content: GeneratedResumeContent): string {
  return [
    content.title,
    content.summary,
    content.skills,
    ...content.experiences.flatMap((e) => [e.role, e.company, ...e.bullets]),
  ].join("\n");
}

/**
 * Surgically inject missing ATS keywords without rewriting bullets or structure.
 * Safe fallback when AI revision regresses the score.
 */
export function applyDeterministicAtsPatches(
  content: GeneratedResumeContent,
  feedback: Pick<AtsScoreResult, "missingKeywords" | "breakdown">
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

  const summaryWeak = feedback.breakdown?.find(
    (b) => b.category === "Summary quality" && b.score < b.maxScore * 0.75
  );
  const summaryMissing = missing.find((k) => !keywordPresentInText(k, result.summary));
  if (summaryWeak && summaryMissing) {
    const trimmed = result.summary.trim().replace(/\.$/, "");
    result.summary = `${trimmed}, with proven ${summaryMissing} experience.`;
  }

  return result;
}

/** Strip common AI buzzwords from summary and bullets — minimal tone patch. */
export function applyDeterministicTonePatches(
  content: GeneratedResumeContent,
  flags: string[] = []
): GeneratedResumeContent {
  if (flags.length === 0) return content;

  const result = cloneContent(content);
  const patterns = flags.map((f) => new RegExp(`\\b${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"));

  function scrub(text: string): string {
    let out = text;
    for (const p of patterns) {
      out = out.replace(p, "").replace(/\s{2,}/g, " ").trim();
    }
    return out.replace(/—/g, "-").replace(/\s+,/g, ",");
  }

  result.summary = scrub(result.summary);
  result.experiences = result.experiences.map((e) => ({
    ...e,
    bullets: e.bullets.map((b) => scrub(b)).filter(Boolean),
  }));

  return result;
}

export type RegenerateEvaluation = {
  ats: AtsScoreResult;
  humanTone: HumanToneScoreResult;
  ruleKeep: RuleKeepScoreResult;
};

export type RegeneratePickResult = {
  content: GeneratedResumeContent;
  score: AtsScoreResult;
  humanToneScore: HumanToneScoreResult;
  ruleKeepScore: RuleKeepScoreResult;
  notice: string;
};

type ScoredCandidate = {
  content: GeneratedResumeContent;
  ats: AtsScoreResult;
  humanTone: HumanToneScoreResult;
  ruleKeep: RuleKeepScoreResult;
};

type ScoreFloors = {
  ats: number;
  tone: number;
  rules: number;
  hasRules: boolean;
  baselineAts: number;
  baselineTone: number;
  baselineRules: number;
};

/**
 * Passing dimensions may dip toward their pass line; failing dimensions must not regress.
 * Example: ATS 96 → 95 is OK when tone/rules were weak and improve.
 */
function buildFloors(
  baselineAts: AtsScoreResult,
  baselineTone: HumanToneScoreResult,
  baselineRules: RuleKeepScoreResult
): ScoreFloors {
  const baselineAtsScore = baselineAts.overall;
  const baselineToneScore = baselineTone.overall;
  const baselineRulesScore = baselineRules.overall;
  const hasRules = baselineRules.totalRules > 0;

  return {
    ats:
      baselineAtsScore >= ATS_PASS_THRESHOLD ? ATS_PASS_THRESHOLD : baselineAtsScore,
    tone:
      baselineToneScore >= HUMAN_TONE_PASS_THRESHOLD
        ? HUMAN_TONE_PASS_THRESHOLD
        : baselineToneScore,
    rules: hasRules
      ? baselineRulesScore >= RULE_KEEP_PASS_THRESHOLD
        ? RULE_KEEP_PASS_THRESHOLD
        : baselineRulesScore
      : 0,
    hasRules,
    baselineAts: baselineAtsScore,
    baselineTone: baselineToneScore,
    baselineRules: baselineRulesScore,
  };
}

function meetsFloors(candidate: ScoredCandidate, floors: ScoreFloors): boolean {
  if (candidate.ats.overall < floors.ats) return false;
  if (candidate.humanTone.overall < floors.tone) return false;
  if (floors.hasRules && candidate.ruleKeep.overall < floors.rules) return false;
  return true;
}

function compositeGain(candidate: ScoredCandidate, floors: ScoreFloors): number {
  let gain =
    Math.max(0, candidate.ats.overall - floors.ats) +
    Math.max(0, candidate.humanTone.overall - floors.tone);
  if (floors.hasRules) {
    gain += Math.max(0, candidate.ruleKeep.overall - floors.rules);
  }
  return gain;
}

function improvementCount(candidate: ScoredCandidate, floors: ScoreFloors): number {
  let count = 0;
  if (candidate.ats.overall > floors.ats) count++;
  if (candidate.humanTone.overall > floors.tone) count++;
  if (floors.hasRules && candidate.ruleKeep.overall > floors.rules) count++;
  return count;
}

function failingDimensionGain(candidate: ScoredCandidate, floors: ScoreFloors): number {
  let gain = 0;
  if (floors.baselineAts < ATS_PASS_THRESHOLD) {
    gain += candidate.ats.overall - floors.baselineAts;
  }
  if (floors.baselineTone < HUMAN_TONE_PASS_THRESHOLD) {
    gain += candidate.humanTone.overall - floors.baselineTone;
  }
  if (floors.hasRules && floors.baselineRules < RULE_KEEP_PASS_THRESHOLD) {
    gain += candidate.ruleKeep.overall - floors.baselineRules;
  }
  return gain;
}

function meetsStrictBaselines(candidate: ScoredCandidate, floors: ScoreFloors): boolean {
  if (candidate.ats.overall < floors.baselineAts) return false;
  if (candidate.humanTone.overall < floors.baselineTone) return false;
  if (floors.hasRules && candidate.ruleKeep.overall < floors.baselineRules) return false;
  return true;
}

/** Penalty when an already-passing dimension drops below its baseline. */
function passingDimensionLoss(candidate: ScoredCandidate, floors: ScoreFloors): number {
  let loss = 0;
  if (floors.baselineAts >= ATS_PASS_THRESHOLD && candidate.ats.overall < floors.baselineAts) {
    loss += floors.baselineAts - candidate.ats.overall;
  }
  if (
    floors.baselineTone >= HUMAN_TONE_PASS_THRESHOLD &&
    candidate.humanTone.overall < floors.baselineTone
  ) {
    loss += floors.baselineTone - candidate.humanTone.overall;
  }
  if (
    floors.hasRules &&
    floors.baselineRules >= RULE_KEEP_PASS_THRESHOLD &&
    candidate.ruleKeep.overall < floors.baselineRules
  ) {
    loss += floors.baselineRules - candidate.ruleKeep.overall;
  }
  return loss;
}

function acceptableCandidate(candidate: ScoredCandidate, floors: ScoreFloors): boolean {
  if (!meetsFloors(candidate, floors)) return false;
  if (meetsStrictBaselines(candidate, floors)) return true;

  const gain = failingDimensionGain(candidate, floors);
  const loss = passingDimensionLoss(candidate, floors);
  return gain > 0 && gain > loss;
}

function needsImprovement(
  ats: AtsScoreResult,
  tone: HumanToneScoreResult,
  rules: RuleKeepScoreResult
): boolean {
  if (ats.overall < ATS_PASS_THRESHOLD) return true;
  if (tone.overall < HUMAN_TONE_PASS_THRESHOLD) return true;
  if (rules.totalRules > 0 && rules.overall < RULE_KEEP_PASS_THRESHOLD) return true;
  return false;
}

function shouldAcceptCandidate(
  candidate: ScoredCandidate,
  baseline: ScoredCandidate,
  floors: ScoreFloors
): boolean {
  if (!acceptableCandidate(candidate, floors)) return false;
  if (!isBetterCandidate(candidate, baseline, floors)) return false;

  const baselineNeedsWork = needsImprovement(
    baseline.ats,
    baseline.humanTone,
    baseline.ruleKeep
  );
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

  const aSum =
    a.ats.overall +
    a.humanTone.overall +
    (floors.hasRules ? a.ruleKeep.overall : 0);
  const bSum =
    b.ats.overall +
    b.humanTone.overall +
    (floors.hasRules ? b.ruleKeep.overall : 0);
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
  const tonePart = formatScoreNotice("Tone", floors.baselineTone, best.humanTone.overall);
  const rulesPart = floors.hasRules
    ? formatScoreNotice("Rules", floors.baselineRules, best.ruleKeep.overall)
    : null;
  const scoreParts = [atsPart, tonePart, rulesPart].filter(Boolean).join("; ");

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
    score: candidate.ats,
    humanToneScore: candidate.humanTone,
    ruleKeepScore: candidate.ruleKeep,
    notice: buildImprovementNotice(floors, candidate, restored),
  };
}

function contentKey(content: GeneratedResumeContent): string {
  return JSON.stringify(content);
}

/** Build surgical patch variants — baseline-first, then AI — to avoid cross-score regressions. */
function buildDeterministicCandidates(
  baseline: GeneratedResumeContent,
  aiDraft: GeneratedResumeContent,
  baselineAts: AtsScoreResult,
  baselineTone: HumanToneScoreResult,
  aiAts: AtsScoreResult,
  aiTone: HumanToneScoreResult
): GeneratedResumeContent[] {
  const baselineToneFlags = baselineTone.flags ?? [];
  const aiToneFlags = aiTone.flags ?? [];
  const seen = new Set<string>();
  const out: GeneratedResumeContent[] = [];

  function add(content: GeneratedResumeContent) {
    const key = contentKey(content);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(content);
  }

  const baselineAtsPatch = applyDeterministicAtsPatches(baseline, baselineAts);
  const baselineTonePatch = applyDeterministicTonePatches(baseline, baselineToneFlags);
  const baselineAtsThenTone = applyDeterministicTonePatches(baselineAtsPatch, baselineToneFlags);
  const baselineToneThenAts = applyDeterministicAtsPatches(baselineTonePatch, baselineAts);

  add(aiDraft);
  add(baselineAtsPatch);
  add(baselineTonePatch);
  add(baselineAtsThenTone);
  add(baselineToneThenAts);

  if (aiAts.missingKeywords.length > 0) {
    add(applyDeterministicAtsPatches(aiDraft, aiAts));
  }
  if (aiToneFlags.length > 0) {
    add(applyDeterministicTonePatches(aiDraft, aiToneFlags));
  }
  if (aiAts.missingKeywords.length > 0 && aiToneFlags.length > 0) {
    add(
      applyDeterministicTonePatches(applyDeterministicAtsPatches(aiDraft, aiAts), aiToneFlags)
    );
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
  baselineTone: HumanToneScoreResult,
  baselineRules: RuleKeepScoreResult,
  aiDraft: GeneratedResumeContent,
  evaluate: (content: GeneratedResumeContent) => Promise<RegenerateEvaluation | null>
): Promise<RegeneratePickResult> {
  const floors = buildFloors(baselineAts, baselineTone, baselineRules);

  const baselineCandidate: ScoredCandidate = {
    content: baseline,
    ats: baselineAts,
    humanTone: baselineTone,
    ruleKeep: baselineRules,
  };

  const aiEval = await evaluate(aiDraft);
  if (!aiEval) {
    return {
      content: baseline,
      score: baselineAts,
      humanToneScore: baselineTone,
      ruleKeepScore: baselineRules,
      notice: "Could not re-score the revision. Kept your previous draft.",
    };
  }

  let best: ScoredCandidate = baselineCandidate;

  const aiScored: ScoredCandidate = {
    content: aiDraft,
    ats: aiEval.ats,
    humanTone: aiEval.humanTone,
    ruleKeep: aiEval.ruleKeep,
  };

  if (
    acceptableCandidate(aiScored, floors) &&
    isBetterCandidate(aiScored, best, floors)
  ) {
    best = aiScored;
  }

  const candidates = buildDeterministicCandidates(
    baseline,
    aiDraft,
    baselineAts,
    baselineTone,
    aiEval.ats,
    aiEval.humanTone
  );

  for (const content of candidates) {
    if (contentKey(content) === contentKey(aiDraft)) continue;

    const candidateEval = await evaluate(content);
    if (!candidateEval) continue;

    const scored: ScoredCandidate = {
      content,
      ats: candidateEval.ats,
      humanTone: candidateEval.humanTone,
      ruleKeep: candidateEval.ruleKeep,
    };

    if (
      acceptableCandidate(scored, floors) &&
      isBetterCandidate(scored, best, floors)
    ) {
      best = scored;
    }
  }

  if (shouldAcceptCandidate(best, baselineCandidate, floors)) {
    const usedPatch = best.content !== aiDraft;
    if (usedPatch) {
      const atsPart = formatScoreNotice("ATS", floors.baselineAts, best.ats.overall);
      const tonePart = formatScoreNotice("Tone", floors.baselineTone, best.humanTone.overall);
      const rulesPart = floors.hasRules
        ? formatScoreNotice("Rules", floors.baselineRules, best.ruleKeep.overall)
        : null;
      const scoreParts = [atsPart, tonePart, rulesPart].filter(Boolean).join("; ");
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
        humanTone: aiEval.humanTone,
        ruleKeep: aiEval.ruleKeep,
      },
      true
    ),
  };
}
