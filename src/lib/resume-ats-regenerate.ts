import { keywordPresentInText } from "@/lib/resume-ats-keywords";
import type { AtsScoreResult, GeneratedResumeContent, HumanToneScoreResult } from "@/lib/resume-types";

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
};

export type RegeneratePickResult = {
  content: GeneratedResumeContent;
  score: AtsScoreResult;
  humanToneScore: HumanToneScoreResult;
  notice: string;
};

type ScoredCandidate = {
  content: GeneratedResumeContent;
  ats: AtsScoreResult;
  humanTone: HumanToneScoreResult;
};

function meetsFloors(
  ats: number,
  tone: number,
  atsFloor: number,
  toneFloor: number
): boolean {
  return ats >= atsFloor && tone >= toneFloor;
}

function compositeGain(
  ats: number,
  tone: number,
  atsFloor: number,
  toneFloor: number
): number {
  return Math.max(0, ats - atsFloor) + Math.max(0, tone - toneFloor);
}

function isBetterCandidate(
  a: ScoredCandidate,
  b: ScoredCandidate,
  atsFloor: number,
  toneFloor: number
): boolean {
  const aOk = meetsFloors(a.ats.overall, a.humanTone.overall, atsFloor, toneFloor);
  const bOk = meetsFloors(b.ats.overall, b.humanTone.overall, atsFloor, toneFloor);
  if (aOk && !bOk) return true;
  if (!aOk && bOk) return false;

  const aGain = compositeGain(a.ats.overall, a.humanTone.overall, atsFloor, toneFloor);
  const bGain = compositeGain(b.ats.overall, b.humanTone.overall, atsFloor, toneFloor);
  if (aGain !== bGain) return aGain > bGain;

  const aSum = a.ats.overall + a.humanTone.overall;
  const bSum = b.ats.overall + b.humanTone.overall;
  return aSum > bSum;
}

function formatScoreNotice(
  label: string,
  before: number,
  after: number
): string {
  if (after > before) return `${label} ${before} → ${after}`;
  if (after < before) return `${label} ${before} → ${after} (dropped)`;
  return `${label} held at ${after}`;
}

function buildImprovementNotice(
  baselineAts: number,
  baselineTone: number,
  best: ScoredCandidate,
  restored: boolean
): string {
  const atsPart = formatScoreNotice("ATS", baselineAts, best.ats.overall);
  const tonePart = formatScoreNotice("Tone", baselineTone, best.humanTone.overall);
  if (restored) {
    return `Regeneration did not improve both scores. Restored previous draft (${atsPart}; ${tonePart}).`;
  }
  const improved =
    best.ats.overall > baselineAts || best.humanTone.overall > baselineTone;
  if (improved) {
    return `Scores updated — ${atsPart}; ${tonePart}.`;
  }
  return `Scores held — ${atsPart}; ${tonePart}.`;
}

/**
 * After AI regenerate, score candidates and never accept a draft below either baseline score.
 * `evaluate` should reuse cached JD keywords (no AI) — pass keywordsCacheKey via /api/resume/score.
 */
export async function pickBestRegenerateResult(
  baseline: GeneratedResumeContent,
  baselineAts: AtsScoreResult,
  baselineTone: HumanToneScoreResult,
  aiDraft: GeneratedResumeContent,
  evaluate: (content: GeneratedResumeContent) => Promise<RegenerateEvaluation | null>
): Promise<RegeneratePickResult> {
  const atsFloor = baselineAts.overall;
  const toneFloor = baselineTone.overall;

  const baselineCandidate: ScoredCandidate = {
    content: baseline,
    ats: baselineAts,
    humanTone: baselineTone,
  };

  const aiEval = await evaluate(aiDraft);
  if (!aiEval) {
    return {
      content: baseline,
      score: baselineAts,
      humanToneScore: baselineTone,
      notice: "Could not re-score the revision. Kept your previous draft.",
    };
  }

  let best: ScoredCandidate = { content: aiDraft, ats: aiEval.ats, humanTone: aiEval.humanTone };

  if (aiEval.ats.missingKeywords.length > 0) {
    const patchedAi = applyDeterministicAtsPatches(aiDraft, aiEval.ats);
    const patchedEval = await evaluate(patchedAi);
    if (patchedEval) {
      const patched: ScoredCandidate = {
        content: patchedAi,
        ats: patchedEval.ats,
        humanTone: patchedEval.humanTone,
      };
      if (isBetterCandidate(patched, best, atsFloor, toneFloor)) best = patched;
    }
  }

  if (aiEval.humanTone.flags && aiEval.humanTone.flags.length > 0) {
    const tonedAi = applyDeterministicTonePatches(aiDraft, aiEval.humanTone.flags);
    const tonedEval = await evaluate(tonedAi);
    if (tonedEval) {
      const toned: ScoredCandidate = {
        content: tonedAi,
        ats: tonedEval.ats,
        humanTone: tonedEval.humanTone,
      };
      if (isBetterCandidate(toned, best, atsFloor, toneFloor)) best = toned;
    }
  }

  const bestMeetsFloors = meetsFloors(
    best.ats.overall,
    best.humanTone.overall,
    atsFloor,
    toneFloor
  );
  const bestImproves = isBetterCandidate(best, baselineCandidate, atsFloor, toneFloor);

  if (bestMeetsFloors && bestImproves) {
    return {
      content: best.content,
      score: best.ats,
      humanToneScore: best.humanTone,
      notice: buildImprovementNotice(atsFloor, toneFloor, best, false),
    };
  }

  if (bestMeetsFloors && !bestImproves) {
    return {
      content: baseline,
      score: baselineAts,
      humanToneScore: baselineTone,
      notice: buildImprovementNotice(atsFloor, toneFloor, best, true),
    };
  }

  const patchedBaseline = applyDeterministicAtsPatches(baseline, baselineAts);
  const patchedBaselineEval = await evaluate(patchedBaseline);
  if (patchedBaselineEval) {
    const patched: ScoredCandidate = {
      content: patchedBaseline,
      ats: patchedBaselineEval.ats,
      humanTone: patchedBaselineEval.humanTone,
    };
    if (isBetterCandidate(patched, best, atsFloor, toneFloor)) best = patched;
  }

  if (
    meetsFloors(best.ats.overall, best.humanTone.overall, atsFloor, toneFloor) &&
    isBetterCandidate(best, baselineCandidate, atsFloor, toneFloor)
  ) {
    const usedPatch = best.content !== aiDraft;
    return {
      content: best.content,
      score: best.ats,
      humanToneScore: best.humanTone,
      notice: usedPatch
        ? `AI revision lowered a score. Applied targeted fixes instead — ${formatScoreNotice("ATS", atsFloor, best.ats.overall)}; ${formatScoreNotice("Tone", toneFloor, best.humanTone.overall)}.`
        : buildImprovementNotice(atsFloor, toneFloor, best, false),
    };
  }

  return {
    content: baseline,
    score: baselineAts,
    humanToneScore: baselineTone,
    notice: buildImprovementNotice(
      atsFloor,
      toneFloor,
      { content: aiDraft, ats: aiEval.ats, humanTone: aiEval.humanTone },
      true
    ),
  };
}
