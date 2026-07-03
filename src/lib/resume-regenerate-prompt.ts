import { ATS_SCORE_MAX } from "@/lib/resume-ats-algorithm";
import { RESUME_PASS_THRESHOLD, RESUME_SCORE_MAX } from "@/lib/resume-unified-score";
import type { AtsScoreResult, RuleKeepScoreResult } from "@/lib/resume-types";

/** Injected on regenerate — guides incremental, non-regressive score optimization. */
export const ITERATIVE_OPTIMIZATION_RULES = [
  "## Iterative content optimization",
  "",
  "Regenerate using the previous evaluation as baseline. Target overall score: **94/100 or higher**.",
  "",
  "Rules:",
  "1. Modify **only** sections responsible for low scores. Do not rewrite content that already scores well.",
  "2. Preserve all high-scoring sections unless a minimal change is strictly required to fix a weak criterion.",
  "3. Improving one criterion **must not reduce** any other criterion score — zero regressions.",
  "4. Treat this as incremental optimization, not a full rewrite.",
  "5. Keep the original writing style, structure, terminology, formatting, and intent unless a change is required for the targeted improvement.",
  "6. Prefer the smallest effective edits that produce the highest score increase.",
  "",
  "Return the full JSON draft with only the necessary localized updates.",
].join("\n");

function weakAtsCategories(ats: AtsScoreResult): string[] {
  return ats.breakdown
    .filter((item) => item.maxScore > 0 && item.score / item.maxScore < 0.75)
    .map((item) => `${item.category} (${item.score}/${item.maxScore})`);
}

function mapWeakSections(ats: AtsScoreResult, ruleKeep: RuleKeepScoreResult): string[] {
  const sections: string[] = [];

  const weakCategories = weakAtsCategories(ats);
  if (weakCategories.length > 0) {
    sections.push(`ATS weak areas: ${weakCategories.join(", ")}`);
  }

  if (ats.missingKeywords.length > 0) {
    sections.push(
      `Missing keywords — add naturally to title, skills, or summary: ${ats.missingKeywords.slice(0, 12).join(", ")}`
    );
  }

  const failedRules = ruleKeep.rules.filter((r) => !r.passed);
  if (failedRules.length > 0) {
    sections.push(
      `Failed custom rules — revise only the affected experience/summary fields: ${failedRules
        .slice(0, 5)
        .map((r) => r.rule)
        .join("; ")}`
    );
  }

  if (sections.length === 0) {
    sections.push("Overall score below target — make minimal ATS and rule-compliance refinements.");
  }

  return sections;
}

function strongSections(ats: AtsScoreResult, ruleKeep: RuleKeepScoreResult): string[] {
  const strengths: string[] = [];

  const strongCategories = ats.breakdown
    .filter((item) => item.maxScore > 0 && item.score / item.maxScore >= 0.85)
    .map((item) => item.category);
  if (strongCategories.length > 0) {
    strengths.push(`Strong ATS areas (do not rewrite): ${strongCategories.join(", ")}`);
  }

  if (ats.matchedKeywords.length > 0) {
    strengths.push(`Keywords already matched: ${ats.matchedKeywords.slice(0, 10).join(", ")}`);
  }

  const passedRules = ruleKeep.rules.filter((r) => r.passed);
  if (passedRules.length > 0) {
    strengths.push(`${passedRules.length} custom rule(s) already passing — leave compliant wording intact`);
  }

  return strengths;
}

/** Score feedback block appended to the regenerate user prompt. */
export function buildRegenerationEvaluationBlock(
  ats: AtsScoreResult,
  ruleKeep: RuleKeepScoreResult,
  overall: number
): string {
  const hasRules = ruleKeep.totalRules > 0;
  const criterionLines = [
    `Overall score: ${overall}/${RESUME_SCORE_MAX} (target ≥ ${RESUME_PASS_THRESHOLD})`,
    `ATS match: ${ats.overall}/${ATS_SCORE_MAX}${ats.passed ? " — passing" : " — below target"}`,
    ...ats.breakdown.map(
      (item) => `  · ${item.category}: ${item.score}/${item.maxScore}${item.notes ? ` — ${item.notes}` : ""}`
    ),
  ];

  if (hasRules) {
    criterionLines.push(
      `Custom rules: ${ruleKeep.overall}/100 — ${ruleKeep.passedRules}/${ruleKeep.totalRules} passed`
    );
    for (const rule of ruleKeep.rules) {
      criterionLines.push(`  · ${rule.passed ? "✓" : "✗"} ${rule.rule}`);
    }
  }

  const strengths = strongSections(ats, ruleKeep);
  const weaknesses = mapWeakSections(ats, ruleKeep);

  return [
    "Previous evaluation (baseline for this regeneration):",
    criterionLines.join("\n"),
    "",
    "Strengths — preserve these:",
    strengths.map((s) => `- ${s}`).join("\n") || "- No dominant strengths identified; change minimally.",
    "",
    "Sections to improve (edit only these):",
    weaknesses.map((s) => `- ${s}`).join("\n"),
    "",
    ITERATIVE_OPTIMIZATION_RULES,
  ].join("\n");
}
