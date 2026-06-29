import { ATS_PASS_THRESHOLD, ATS_SCORE_MAX } from "@/lib/resume-ats-algorithm";
import { HUMAN_TONE_PASS_THRESHOLD, HUMAN_TONE_SCORE_MAX } from "@/lib/resume-human-tone-algorithm";
import { RULE_KEEP_PASS_THRESHOLD, RULE_KEEP_SCORE_MAX } from "@/lib/resume-rule-keep-constants";
import type { AtsScoreResult, GeneratedResumeContent, HumanToneScoreResult, RuleKeepScoreResult } from "@/lib/resume-types";

export const RESUME_AI_MODEL = "deepseek-v4-pro";

export const RESUME_MAX_TOKENS = 16384;

export const RESUME_SYSTEM_PROMPT = `You are an expert resume writer for software engineers.
Rewrite the professional title line, summary, skills, and experience bullets for a target job.
Keep the same companies, roles, and date ranges from the template — do not invent new employers.

Return ONLY valid json with this exact shape:
{
  "title": "string",
  "summary": "string",
  "skills": "comma-separated skill list",
  "experiences": [
    {
      "company": "string",
      "role": "string",
      "dates": "MM/YYYY – MM/YYYY",
      "bullets": ["bullet 1", "bullet 2"]
    }
  ]
}

Rules:
- title: one professional headline line tailored to the target job (pipe-separated keywords OK, e.g. "Senior Backend Engineer | Node.js | AWS").
- summary: 2–4 sentences, ATS-friendly, no first-person pronouns.
- skills: one comma-separated line, mirror job keywords where truthful.
- experiences: MUST include exactly the same number of companies as the template, in the same order.
- For each experience entry, copy company, role, and dates EXACTLY from the template list (do not put bullet text in company/role fields).
- Only rewrite the bullets array for each company; keep the bullet count per company as specified in the template list.
- Additional user instructions apply to summary, skills, and bullet wording only — never change employer names, roles, or dates.
- No markdown fences, no commentary — valid json only.`;

export const RESUME_REGENERATE_SYSTEM_SUFFIX = `When regeneration context is provided, this is a TARGETED REVISION pass — not a full rewrite. You must improve ALL THREE evaluation systems together using the analysis in the user message:
1) ATS match (keyword coverage, title, skills, format, failed gates) — target ${ATS_PASS_THRESHOLD}+
2) Human tone (natural wording, variety, collaboration cues, no buzzwords) — target ${HUMAN_TONE_PASS_THRESHOLD}+
3) Rule Keep (private writing rules from the user's prompt — fix every failed rule category) — target ${RULE_KEEP_PASS_THRESHOLD}+

Preservation rules (highest priority):
- Start from the previous draft in the user message and keep all strong, relevant content unchanged.
- Preserve structure, metrics, achievements, and experience details wherever they already score well.
- Do not rewrite entire sections, companies, or bullet lists from scratch.
- Copy company, role, and dates exactly from the previous draft (and template).

Revision rules:
- Address gaps listed in ATS, human-tone, and rule-keep feedback using the SURGICAL EDIT PLAN zones only.
- Never rewrite a whole section, company block, or bullet list — change the minimum words in the minimum fields.
- If a bullet already passes ATS, tone, and rules, return it character-for-character unchanged.
- When scores conflict: add keywords via title/skills first; fix tone with in-place word swaps (keep metrics and tech terms); fix rules in the single field cited by the failed rule.
- The revised draft must NOT drop below pass thresholds (ATS ${ATS_PASS_THRESHOLD}+, tone ${HUMAN_TONE_PASS_THRESHOLD}+, rules ${RULE_KEEP_PASS_THRESHOLD}+).
- Wrap only newly emphasized priority keywords in **bold** where truthful.`;

export function buildResumeSystemPrompt(regenerate = false): string {
  return regenerate
    ? `${RESUME_SYSTEM_PROMPT}\n\n${RESUME_REGENERATE_SYSTEM_SUFFIX}`
    : RESUME_SYSTEM_PROMPT;
}

export function buildHumanToneRegeneratePromptSection(
  feedback: HumanToneScoreResult,
  targetScore = HUMAN_TONE_PASS_THRESHOLD
): string {
  const failedGates = feedback.gates?.filter((g) => !g.passed) ?? [];
  const weakCategories = feedback.breakdown
    .filter((b) => b.score < b.maxScore * 0.75)
    .map((b) => `- ${b.category}: ${b.score}/${b.maxScore} — ${b.notes}`);

  return [
    `HUMAN TONE REVISION — previous score ${feedback.overall}/${HUMAN_TONE_SCORE_MAX}. Target: ${targetScore}+ (co-equal with ATS).`,
    `TONE FLOOR: Human tone MUST stay at or above ${feedback.overall}. Improve natural, recruiter-friendly wording — not keyword stuffing.`,
    `Previous tone summary: ${feedback.summary}`,
    feedback.flags && feedback.flags.length > 0 &&
      `Remove or replace these AI-style buzzwords/phrases: ${feedback.flags.join(", ")}`,
    feedback.recommendations.length > 0 &&
      `Human-tone improvements (apply surgically alongside ATS fixes):\n${feedback.recommendations.map((r) => `- ${r}`).join("\n")}`,
    failedGates.length > 0 &&
      `Failed tone gates:\n${failedGates.map((g) => `- ${g.name}: ${g.detail}`).join("\n")}`,
    weakCategories.length > 0 &&
      `Weak tone categories (improve without breaking ATS keywords):\n${weakCategories.join("\n")}`,
    `Tone revision checklist:
- Vary action verbs and bullet openings — no repeated phrasing.
- Add collaboration or context in bullets that lack human cues.
- Use specific metrics (ms, users, $) instead of generic percentages on every line.
- Remove em-dashes, bracket labels, first-person, and buzzword clutter.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildAtsRegeneratePromptSection(
  feedback: AtsScoreResult,
  previousContent: GeneratedResumeContent,
  targetScore = ATS_PASS_THRESHOLD
): string {
  const failedGates = feedback.gates?.filter((g) => !g.passed) ?? [];
  const weakCategories = feedback.breakdown
    .filter((b) => b.score < b.maxScore * 0.75)
    .map((b) => `- ${b.category}: ${b.score}/${b.maxScore} — ${b.notes}`);

  const previousDraft = {
    title: previousContent.title,
    summary: previousContent.summary,
    skills: previousContent.skills,
    experiences: previousContent.experiences.map((e) => ({
      company: e.company,
      role: e.role,
      dates: e.dates,
      bullets: e.bullets,
    })),
  };

  return [
    `ATS TARGETED REVISION — previous score ${feedback.overall}/${ATS_SCORE_MAX}. Target: ${targetScore}+ (strict acceptance).`,
    `SCORE FLOOR: The revised draft MUST score at least ${feedback.overall} — never below the previous version. If a change would lower keyword coverage, format compliance, or title alignment, do not make it.`,
    `IMPORTANT: Do NOT rewrite the entire resume. Use the previous draft below as your base. Preserve all strong and relevant content. Revise only what is necessary to close the ATS gaps listed here.`,
    `Previous evaluation summary: ${feedback.summary}`,
    feedback.missingKeywords.length > 0 &&
      `Missing must-have keywords — add only where needed (title, summary, skills, or specific bullets; do not rewrite unaffected sections): ${feedback.missingKeywords.join(", ")}`,
    feedback.recommendations.length > 0 &&
      `Required improvements (apply surgically — one issue at a time, minimal edits):\n${feedback.recommendations.map((r) => `- ${r}`).join("\n")}`,
    failedGates.length > 0 &&
      `Failed pass gates (fix only what these gates require):\n${failedGates.map((g) => `- ${g.name}: ${g.detail}`).join("\n")}`,
    weakCategories.length > 0 &&
      `Weak scoring categories (touch only the sections tied to each category):\n${weakCategories.join("\n")}`,
    feedback.matchedKeywords.length > 0 &&
      `Protected keywords — do NOT remove or rephrase these; keep exact wording where already present: ${feedback.matchedKeywords.slice(0, 24).join(", ")}`,
    `Previous draft (BASE VERSION — retain structure, style, and wording except where ATS gaps above require a small change):\n${JSON.stringify(previousDraft, null, 2)}`,
    `Revision checklist:
- Return the same number of experience entries and the same bullet count per company as the previous draft.
- Copy company, role, and dates from the previous draft unchanged.
- Leave unchanged any title line, summary sentence, skill, or bullet that already supports ATS matching.
- Edit only sections directly tied to missing keywords, failed gates, weak categories, or recommendations.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildRuleKeepRegeneratePromptSection(
  feedback: RuleKeepScoreResult,
  targetScore = RULE_KEEP_PASS_THRESHOLD
): string {
  if (feedback.totalRules === 0) return "";

  const failed = feedback.rules.filter((r) => !r.passed);

  return [
    `RULE KEEP REVISION — previous score ${feedback.overall}/${RULE_KEEP_SCORE_MAX} (${feedback.passedRules}/${feedback.totalRules} rules passed). Target: ${targetScore}+.`,
    `RULE FLOOR: Rule Keep MUST stay at or above ${feedback.overall}. Fix every failed rule with minimal, surgical edits.`,
    `Previous rule summary: ${feedback.summary}`,
    failed.length > 0 &&
      `Failed rules — address each gap in the resume text (category + auditor finding):\n${failed
        .map((r, index) => `- Rule ${index + 1} [${r.category}]: ${r.detail}`)
        .join("\n")}`,
    feedback.recommendations.length > 0 &&
      `Rule gaps to close:\n${feedback.recommendations.map((r) => `- ${r}`).join("\n")}`,
    `Rule revision checklist:
- Edit only title, summary, skills, or bullets needed to satisfy failed rules.
- Do not drop ATS keywords or natural tone while fixing a rule.
- Balance all three targets — ATS, human tone, and rule compliance.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Maps failing scores to exact edit zones so one fix does not rewrite unrelated fields. */
export function buildSurgicalEditPlanSection(
  atsFeedback?: AtsScoreResult,
  humanToneFeedback?: HumanToneScoreResult,
  ruleKeepFeedback?: RuleKeepScoreResult
): string {
  const atsPassing = !atsFeedback || atsFeedback.overall >= ATS_PASS_THRESHOLD;
  const tonePassing = !humanToneFeedback || humanToneFeedback.overall >= HUMAN_TONE_PASS_THRESHOLD;
  const rulesActive = Boolean(ruleKeepFeedback && ruleKeepFeedback.totalRules > 0);
  const rulesPassing =
    !rulesActive || (ruleKeepFeedback!.overall >= RULE_KEEP_PASS_THRESHOLD);

  const lines = [
    "SURGICAL EDIT PLAN (mandatory) — edit ONLY the zones below. All other fields stay verbatim from the previous draft.",
  ];

  if (atsFeedback && !atsPassing) {
    lines.push(
      `ATS is below target (${atsFeedback.overall}) — edit ONLY: title line, skills line, summary (at most one short clause), and specific bullets missing keywords. Do NOT rewrite bullets that already contain must-have keywords. Prefer adding keywords to skills/title before touching bullets.`
    );
  } else if (atsFeedback) {
    lines.push(
      `ATS is already strong (${atsFeedback.overall}) — do NOT rephrase title, skills, or summary for keywords. Keep matched keywords exactly as written.`
    );
  }

  if (humanToneFeedback && !tonePassing) {
    lines.push(
      `Human tone is below target (${humanToneFeedback.overall}) — edit ONLY bullets with repetition, buzzwords, or weak openers. Swap verbs and add collaboration context in-place. Do NOT remove ATS keywords or metrics from edited bullets.`
    );
  } else if (humanToneFeedback) {
    lines.push(
      `Human tone is already strong (${humanToneFeedback.overall}) — do NOT rephrase bullets for style unless a rule requires it.`
    );
  }

  if (rulesActive && ruleKeepFeedback && !rulesPassing) {
    const failed = ruleKeepFeedback.rules.filter((r) => !r.passed);
    lines.push(
      `Rule keep is below target (${ruleKeepFeedback.overall}) — fix ONLY the field tied to each failed rule:\n${failed
        .map((r, i) => `- Rule ${i + 1} [${r.category}]: ${r.detail}`)
        .join("\n")}`
    );
  } else if (rulesActive && ruleKeepFeedback) {
    lines.push(
      `Rule keep is already strong (${ruleKeepFeedback.overall}) — do not edit fields for rules that already pass.`
    );
  }

  lines.push(
    `Conflict resolution: if improving one score would hurt another, use this order — (1) skills/title for ATS keywords, (2) in-place bullet word swaps for tone, (3) smallest rule fix in the cited field only. Never replace a full bullet or summary paragraph.`
  );

  return lines.join("\n\n");
}

export function buildResumeUserPrompt({
  jobTitle,
  companyName,
  jobDescription,
  customPrompt,
  headerTitle,
  existingExperiences,
  atsFeedback,
  humanToneFeedback,
  ruleKeepFeedback,
  previousContent,
}: {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  customPrompt: string;
  headerTitle: string;
  existingExperiences: GeneratedResumeContent["experiences"];
  atsFeedback?: AtsScoreResult;
  humanToneFeedback?: HumanToneScoreResult;
  ruleKeepFeedback?: RuleKeepScoreResult;
  previousContent?: GeneratedResumeContent;
}): string {
  const isRegenerate = Boolean(previousContent && atsFeedback);

  const experienceInstructions = isRegenerate
    ? `Previous draft companies (${previousContent!.experiences.length} required — copy company, role, dates exactly from previous draft; keep same bullet count per company; revise bullets only where ATS or human-tone feedback requires):\n${previousContent!.experiences
        .map(
          (e, i) =>
            `${i + 1}. company="${e.company}" | role="${e.role}" | dates="${e.dates}" | bullets: keep ${e.bullets.length} bullets, change only if needed for ATS or tone gaps`
        )
        .join("\n")}`
    : `Template companies (${existingExperiences.length} required — copy company, role, dates exactly into each JSON experience object):\n${existingExperiences
        .map(
          (e, i) =>
            `${i + 1}. company="${e.company}" | role="${e.role}" | dates="${e.dates}" | bullets: rewrite all ${e.bullets.length} bullets`
        )
        .join("\n")}`;

  const closingInstruction = isRegenerate
    ? `Return exactly ${previousContent!.experiences.length} objects in experiences[]. Surgical triple-target revision only — improve weak scores using the edit zones above; leave all other text unchanged. Return valid json only.`
    : `Return exactly ${existingExperiences.length} objects in experiences[]. Rewrite title, summary, skills, and bullets only. Return valid json only.`;

  const surgicalPlan =
    isRegenerate &&
    buildSurgicalEditPlanSection(atsFeedback, humanToneFeedback, ruleKeepFeedback);

  return [
    jobTitle && `Target job title: ${jobTitle}`,
    `Target company: ${companyName}`,
    jobDescription && `Job description:\n${jobDescription}`,
    customPrompt && `Additional instructions:\n${customPrompt}`,
    headerTitle && `Current resume title line: ${headerTitle}`,
    experienceInstructions,
    surgicalPlan,
    atsFeedback &&
      previousContent &&
      buildAtsRegeneratePromptSection(atsFeedback, previousContent),
    humanToneFeedback && buildHumanToneRegeneratePromptSection(humanToneFeedback),
    ruleKeepFeedback && buildRuleKeepRegeneratePromptSection(ruleKeepFeedback),
    closingInstruction,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Pull the first complete `{...}` JSON object from model text (handles fences and preamble). */
export function extractResumeJsonRaw(raw: string): string {
  const stripped = raw
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .trim();
  if (!stripped) return "";

  const start = stripped.indexOf("{");
  if (start === -1) return stripped;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < stripped.length; i += 1) {
    const ch = stripped[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return stripped.slice(start, i + 1);
    }
  }

  return stripped.slice(start);
}

export function pickResumeModelText(output: string, thinking: string): string {
  const out = output.trim();
  const think = thinking.trim();
  if (out && think) {
    const outJson = extractResumeJsonRaw(out);
    const thinkJson = extractResumeJsonRaw(think);
    if (thinkJson.length > outJson.length) return think;
  }
  return out || think;
}

function repairTruncatedJson(text: string): string {
  let s = text.trimEnd();
  s = s.replace(/,\s*([}\]])/g, "$1");

  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escape = false;

  for (const ch of s) {
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") braces += 1;
    else if (ch === "}") braces -= 1;
    else if (ch === "[") brackets += 1;
    else if (ch === "]") brackets -= 1;
  }

  if (inString) s += '"';
  while (brackets > 0) {
    s += "]";
    brackets -= 1;
  }
  while (braces > 0) {
    s += "}";
    braces -= 1;
  }

  return s;
}

function tryParseResumeJson(jsonText: string): GeneratedResumeContent | null {
  const attempts = [jsonText, repairTruncatedJson(jsonText)];
  for (const attempt of attempts) {
    if (!attempt) continue;
    try {
      const parsed = JSON.parse(attempt) as GeneratedResumeContent;
      if (parsed?.title && parsed?.summary && parsed?.skills && Array.isArray(parsed.experiences)) {
        return parsed;
      }
    } catch {
      // try next
    }
  }
  return null;
}

export function parseResumeJsonContent(raw: string): GeneratedResumeContent {
  const jsonText = extractResumeJsonRaw(raw);
  if (!jsonText) {
    throw new Error("AI returned no resume content. Please try again.");
  }

  const parsed = tryParseResumeJson(jsonText);
  if (!parsed) {
    throw new Error("AI returned invalid JSON. Try again or shorten the job description.");
  }

  return {
    title: String(parsed.title).trim(),
    summary: String(parsed.summary).trim(),
    skills: String(parsed.skills).trim(),
    experiences: parsed.experiences.map((e) => ({
      company: String(e.company ?? "").trim(),
      role: String(e.role ?? "").trim(),
      dates: String(e.dates ?? "").trim(),
      bullets: (e.bullets ?? []).map((b) => String(b).trim()).filter(Boolean),
    })),
  };
}

function matchExperienceByCompany(
  parsedExperiences: GeneratedResumeContent["experiences"],
  existing: GeneratedResumeContent["experiences"][number],
  index: number
) {
  const byIndex = parsedExperiences[index];
  if (byIndex?.bullets?.length) return byIndex;

  const key = existing.company.toLowerCase();
  return parsedExperiences.find(
    (e) =>
      e.company.toLowerCase().includes(key) ||
      key.includes(e.company.toLowerCase()) ||
      e.role.toLowerCase().includes(key)
  );
}

export function mergeResumeWithTemplate(
  parsed: GeneratedResumeContent,
  existingExperiences: GeneratedResumeContent["experiences"],
  fallbackTitle: string
): GeneratedResumeContent {
  return {
    title: parsed.title || fallbackTitle,
    summary: parsed.summary,
    skills: parsed.skills,
    experiences: existingExperiences.map((existing, i) => {
      const generated = matchExperienceByCompany(parsed.experiences, existing, i);
      return {
        company: existing.company,
        role: existing.role,
        dates: existing.dates,
        bullets: generated?.bullets?.length ? generated.bullets : existing.bullets,
      };
    }),
  };
}

export type ResumeGenerationPhase =
  | "starting"
  | "analyzing"
  | "title"
  | "summary"
  | "skills"
  | "experiences"
  | "finalizing";

export function detectResumeGenerationPhase(
  thinking: string,
  output: string
): ResumeGenerationPhase {
  const text = output;
  if (/"bullets"/.test(text) || /"experiences"\s*:\s*\[/.test(text)) return "experiences";
  if (/"skills"/.test(text)) return "skills";
  if (/"summary"/.test(text)) return "summary";
  if (/"title"/.test(text)) return "title";
  if (thinking.length > 40 || output.length > 8) return "analyzing";
  return "starting";
}

export const RESUME_PHASE_LABELS: Record<ResumeGenerationPhase, string> = {
  starting: "Starting DeepSeek",
  analyzing: "Analyzing job & template",
  title: "Crafting resume title",
  summary: "Writing professional summary",
  skills: "Building skillsets",
  experiences: "Tailoring experience bullets",
  finalizing: "Finalizing your draft",
};
