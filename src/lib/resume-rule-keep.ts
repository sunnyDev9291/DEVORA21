import { createHash } from "crypto";
import { completeDeepSeek } from "@/lib/deepseek-stream";
import { getCachedValue, setCachedValue } from "@/lib/server-cache";
import { buildEmptyRuleKeepSummary, getParsedPromptRules, type ParsedPromptRule } from "@/lib/resume-rule-keep-parse";
import type { GeneratedResumeContent, RuleKeepScoreResult } from "@/lib/resume-types";

import { RULE_KEEP_PASS_THRESHOLD, RULE_KEEP_SCORE_MAX } from "@/lib/resume-rule-keep-constants";

const RULE_BATCH_SIZE = 22;

const RULE_AUDIT_SYSTEM = `You are a strict resume rule auditor.
You receive numbered writing rules from the user's prompt and a generated resume as JSON (title, summary, skills, experiences with bullets).

For EACH rule index, decide whether the resume content complies. Judge only the resume fields — not whether the AI followed meta/process steps about ATS scoring or file naming unless the rule explicitly applies to visible resume text.

Return ONLY valid json:
{
  "checks": [
    { "ruleIndex": 0, "passed": true, "detail": "one short reason" }
  ]
}

Include exactly one object per rule index provided. Be strict but fair.`;

function contentFingerprint(content: GeneratedResumeContent): string {
  return createHash("sha256")
    .update(JSON.stringify(content))
    .digest("hex")
    .slice(0, 24);
}

function promptFingerprint(customPrompt: string): string {
  return createHash("sha256").update(customPrompt.trim()).digest("hex").slice(0, 24);
}

function resumePayload(content: GeneratedResumeContent): string {
  return JSON.stringify(
    {
      title: content.title,
      summary: content.summary,
      skills: content.skills,
      experiences: content.experiences.map((e) =>
        e.projects?.length
          ? {
              company: e.company,
              role: e.role,
              dates: e.dates,
              projects: e.projects,
            }
          : {
              company: e.company,
              role: e.role,
              dates: e.dates,
              bullets: e.bullets,
            }
      ),
    },
    null,
    2
  );
}

function parseAuditJson(raw: string, batchOffset: number): Array<{ ruleIndex: number; passed: boolean; detail: string }> {
  try {
    const parsed = JSON.parse(raw) as {
      checks?: Array<{ ruleIndex?: number; passed?: boolean; detail?: string }>;
    };
    if (!Array.isArray(parsed.checks)) return [];

    return parsed.checks
      .filter((c) => typeof c.ruleIndex === "number")
      .map((c) => ({
        ruleIndex: batchOffset + (c.ruleIndex as number),
        passed: Boolean(c.passed),
        detail: String(c.detail ?? "").trim() || (c.passed ? "Compliant" : "Not met"),
      }));
  } catch {
    return [];
  }
}

async function auditRuleBatch(
  rules: ParsedPromptRule[],
  batchOffset: number,
  content: GeneratedResumeContent
): Promise<Array<{ ruleIndex: number; passed: boolean; detail: string }>> {
  const batch = rules.slice(batchOffset, batchOffset + RULE_BATCH_SIZE);
  if (batch.length === 0) return [];

  const rulesBlock = batch
    .map((r, i) => `${i}. [${r.category}] ${r.rule}`)
    .join("\n");

  const raw = await completeDeepSeek(
    [
      { role: "system", content: RULE_AUDIT_SYSTEM },
      {
        role: "user",
        content: `Rules (use ruleIndex 0..${batch.length - 1}):\n${rulesBlock}\n\nResume JSON:\n${resumePayload(content)}`,
      },
    ],
    4096,
    { jsonObject: true }
  );

  return parseAuditJson(raw, batchOffset);
}

function buildResult(
  rules: ParsedPromptRule[],
  checks: Array<{ ruleIndex: number; passed: boolean; detail: string }>
): RuleKeepScoreResult {
  const checkMap = new Map(checks.map((c) => [c.ruleIndex, c]));

  const ruleResults = rules.map((r, index) => {
    const check = checkMap.get(index);
    return {
      id: r.id,
      rule: r.rule,
      category: r.category,
      passed: check?.passed ?? false,
      detail: check?.detail ?? "Could not evaluate this rule.",
    };
  });

  const passedRules = ruleResults.filter((r) => r.passed).length;
  const totalRules = ruleResults.length;
  const overall =
    totalRules > 0 ? Math.round((passedRules / totalRules) * RULE_KEEP_SCORE_MAX) : RULE_KEEP_SCORE_MAX;
  const passed = totalRules > 0 ? overall >= RULE_KEEP_PASS_THRESHOLD : true;

  const failed = ruleResults.filter((r) => !r.passed);
  const recommendations = failed.slice(0, 6).map((r) => `${r.category}: ${r.rule}`);

  const summary =
    totalRules === 0
      ? buildEmptyRuleKeepSummary()
      : passed
        ? `Rule Keep passed (${passedRules}/${totalRules} rules, ${overall}/${RULE_KEEP_SCORE_MAX}).`
        : `Rule Keep ${overall}/${RULE_KEEP_SCORE_MAX} — ${failed.length} rule(s) need fixes.`;

  return {
    overall,
    passed,
    totalRules,
    passedRules,
    rules: ruleResults,
    recommendations,
    summary,
    algorithm: "rule-keep-v1",
  };
}

export function emptyRuleKeepScore(): RuleKeepScoreResult {
  return {
    overall: RULE_KEEP_SCORE_MAX,
    passed: true,
    totalRules: 0,
    passedRules: 0,
    rules: [],
    recommendations: [],
    summary: buildEmptyRuleKeepSummary(),
    algorithm: "rule-keep-v1",
  };
}

export async function evaluateRuleKeepScore(
  content: GeneratedResumeContent,
  customPrompt: string
): Promise<RuleKeepScoreResult> {
  const rules = await getParsedPromptRules(customPrompt);
  if (rules.length === 0) {
    return emptyRuleKeepScore();
  }

  const cacheKey = `rule-keep:${promptFingerprint(customPrompt)}:${contentFingerprint(content)}`;
  const cached = await getCachedValue<RuleKeepScoreResult>(cacheKey);
  if (cached) return cached;

  const allChecks: Array<{ ruleIndex: number; passed: boolean; detail: string }> = [];

  for (let offset = 0; offset < rules.length; offset += RULE_BATCH_SIZE) {
    const batchChecks = await auditRuleBatch(rules, offset, content);
    allChecks.push(...batchChecks);
  }

  const result = buildResult(rules, allChecks);
  await setCachedValue(cacheKey, result, 60 * 60 * 1000);
  return result;
}
