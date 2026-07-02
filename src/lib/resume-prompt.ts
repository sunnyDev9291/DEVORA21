import { ATS_PASS_THRESHOLD, ATS_SCORE_MAX } from "@/lib/resume-ats-algorithm";
import { HUMAN_TONE_PASS_THRESHOLD, HUMAN_TONE_SCORE_MAX } from "@/lib/resume-human-tone-algorithm";
import { RULE_KEEP_PASS_THRESHOLD, RULE_KEEP_SCORE_MAX, RULE_KEEP_GUARD_THRESHOLD } from "@/lib/resume-rule-keep-constants";
import type { TemplateContentSamples } from "@/lib/resume-docx";
import { applyResumeContentPostProcess } from "@/lib/resume-content-postprocess";
import { isProjectLayout, normalizeResumeExperience, normalizeResumeProject } from "@/lib/resume-experience-utils";
import type { AtsScoreResult, GeneratedResumeContent, HumanToneScoreResult, ResumeTemplateLayout, RuleKeepScoreResult } from "@/lib/resume-types";

export const RESUME_AI_MODEL = "deepseek-v4-pro";

export const RESUME_MAX_TOKENS = 16384;

export const RESUME_SYSTEM_PROMPT = `You are a Senior ATS resume optimizer for software engineers.
Rewrite the professional title line, summary, skills, and experience bullets for a target job description.
Keep the same companies, roles, and date ranges from the template — do not invent new employers.

Return ONLY valid json with this exact shape:
{
  "title": "string",
  "summary": "string",
  "skills": "string (one line OR multiple lines separated by \\n for category groups)",
  "experiences": [
    {
      "company": "string",
      "role": "string",
      "dates": "MM/YYYY – MM/YYYY",
      "bullets": ["bullet 1", "bullet 2"]
    }
  ]
}

Template fidelity (critical):
- Mirror the TEMPLATE STYLE REFERENCE summary voice, length, and structure.
- Mirror the template skills format exactly (grouped categories with "Category: item, item" OR comma list — same layout as template).
- Mirror template bullet style: sentence length, verb openings, technical density, and tone from sample bullets.
- Follow ALL rules in the user's Additional instructions — they override generic defaults.

Bold in JSON (required for Word rendering):
- Wrap every skill category label with **double asterisks** before the colon (e.g. **Languages:** **Java**, **Python**).
- Wrap every concrete tech term in the skills field with **double asterisks** (e.g. **Java**, **Spring Boot**).
- Wrap every skillset/tech term in experience bullets with **double asterisks** when it appears (e.g. built **React** hooks with **Redux Toolkit**).
- User rules that say "no symbols" mean no bracket labels like [C-Java/...] — **bold markers are required**, not forbidden.

Content rules:
- title: one headline line tailored to the JD (pipe-separated keywords OK).
- summary: match template style; ATS-friendly; no first-person pronouns.
- skills: only concrete technical items (languages, frameworks, DBs, tools, cloud); group by category when template does; no process/buzzword phrases.
- experiences: MUST include exactly the same number of companies as the template, in the same order.
- Copy company and dates EXACTLY from the template list.
- Rewrite each experience role/title line for the target JD (truthful; same employer and dates).
- Return exactly the bullet count per company specified in the template list.
- Additional user instructions apply to summary, skills, and bullet wording only.
- No markdown fences, no commentary — valid json only.`;

export const RESUME_PROJECTS_SYSTEM_PROMPT = `You are a Senior ATS resume optimizer for software engineers.
Rewrite the professional title line, summary, skills, experience role lines, and experience project blocks for a target job description.
Keep the same companies, date ranges, and project names from the template — do not invent new employers or projects.

Return ONLY valid json with this exact shape:
{
  "title": "string",
  "summary": "string",
  "skills": "string (one line OR multiple lines separated by \\n for category groups)",
  "experiences": [
    {
      "company": "string",
      "role": "string",
      "dates": "MM/YYYY – MM/YYYY",
      "projects": [
        {
          "name": "string",
          "businessChallenge": "string",
          "assignedResponsibility": "string",
          "action": "string",
          "result": "string"
        }
      ]
    }
  ]
}

Template fidelity (critical):
- Mirror the TEMPLATE STYLE REFERENCE summary voice, length, and structure.
- Mirror the template skills format exactly (grouped categories with "Category: item, item" OR comma list — same layout as template).
- Mirror template project style: field lengths, verb openings, technical density, and tone from sample projects.
- Each project must include all four BAR fields: businessChallenge, assignedResponsibility, action, result.
- Follow ALL rules in the user's Additional instructions — they override generic defaults.

Bold in JSON (required for Word rendering):
- Wrap every skill category label with **double asterisks** before the colon (e.g. **Languages:** **Java**, **Python**).
- Wrap every concrete tech term in the skills field with **double asterisks** (e.g. **Java**, **Spring Boot**).
- Wrap skillset/tech terms in project fields (challenge, responsibility, action, result) with **double asterisks** when they appear.

Content rules:
- title: one headline line tailored to the JD (pipe-separated keywords OK).
- summary: match template style; ATS-friendly; no first-person pronouns.
- skills: only concrete technical items; group by category when template does.
- experiences: MUST include exactly the same number of companies as the template, in the same order.
- Copy company and dates EXACTLY from the template list.
- Rewrite each experience role/title line for the target JD (truthful; same employer and dates).
- Return exactly the project count per company specified in the template list.
- Copy project names EXACTLY from the template — do not rename projects.
- Rewrite ONLY the BAR field values (businessChallenge, assignedResponsibility, action, result) — do NOT include label prefixes like "Business Challenge:" in JSON values.
- No markdown fences, no commentary — valid json only.`;

export const RESUME_REGENERATE_SYSTEM_SUFFIX = `When regeneration context is provided, this is a TARGETED REVISION pass — not a full rewrite.

Priority order (highest first):
1) RULE KEEP — user prompt rules are sacred. Never break a passing rule to improve ATS or tone.
2) Preserve all text that already passes rules, tone, and ATS — return it verbatim.
3) ATS and human tone — improve only weak dimensions using the SURGICAL EDIT PLAN zones.

Targets: ATS ${ATS_PASS_THRESHOLD}+, tone ${HUMAN_TONE_PASS_THRESHOLD}+, rules ${RULE_KEEP_PASS_THRESHOLD}+.

Preservation rules:
- Start from the previous draft and keep strong content unchanged.
- Do not rewrite entire sections, companies, or bullet lists.
- Copy company, role, and dates exactly from the previous draft.

Revision rules:
- When rule keep is ${RULE_KEEP_GUARD_THRESHOLD}+, add ATS keywords ONLY to title and skills — do NOT edit summary or experience bullets for keywords.
- Never rewrite a whole bullet — change the minimum words in the minimum field.
- If an ATS or tone fix would break any passing rule, skip it and use skills/title only.
- Wrap only newly emphasized priority keywords in **bold** where truthful and allowed by rules.
- When editing bullets, keep **bold** on all skillset/tech terms that appear in the skills line.`;

export function buildTemplateStyleSection(samples?: TemplateContentSamples): string {
  if (!samples) return "";
  const parts: string[] = [
    "TEMPLATE STYLE REFERENCE — match this layout and voice in your JSON output (do not copy verbatim; tailor to the JD):",
  ];

  if (samples.summary) {
    parts.push(`Template summary (style reference):\n${samples.summary}`);
  }
  if (samples.skills) {
    parts.push(
      `Template skills (format reference — use the same category grouping and **bold** tech terms):\n${samples.skills}`
    );
  }
  if (samples.sampleBullets.length > 0) {
    parts.push(
      `Template experience bullets (style reference — match length, tone, and **bold** tech terms):\n${samples.sampleBullets
        .map((b, i) => `${i + 1}. ${b}`)
        .join("\n")}`
    );
  }
  if (samples.sampleProjects.length > 0) {
    parts.push(
      `Template experience projects (style reference — match field lengths, tone, and **bold** tech terms):\n${samples.sampleProjects
        .map((p, i) =>
          [
            `${i + 1}. Project: ${p.name}`,
            `   Business Challenge: ${p.businessChallenge}`,
            `   Assigned Responsibility: ${p.assignedResponsibility}`,
            `   Action: ${p.action}`,
            `   Result: ${p.result}`,
          ].join("\n")
        )
        .join("\n\n")}`
    );
  }

  return parts.length > 1 ? parts.join("\n\n") : "";
}

export function buildResumeSystemPrompt(
  regenerate = false,
  layout: ResumeTemplateLayout = "bullets"
): string {
  const base = isProjectLayout(layout) ? RESUME_PROJECTS_SYSTEM_PROMPT : RESUME_SYSTEM_PROMPT;
  return regenerate ? `${base}\n\n${RESUME_REGENERATE_SYSTEM_SUFFIX}` : base;
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
  targetScore = ATS_PASS_THRESHOLD,
  ruleKeepFeedback?: RuleKeepScoreResult
): string {
  const failedGates = feedback.gates?.filter((g) => !g.passed) ?? [];
  const weakCategories = feedback.breakdown
    .filter((b) => b.score < b.maxScore * 0.75)
    .map((b) => `- ${b.category}: ${b.score}/${b.maxScore} — ${b.notes}`);

  const rulesGuarded =
    Boolean(ruleKeepFeedback?.totalRules) &&
    ruleKeepFeedback!.overall >= RULE_KEEP_GUARD_THRESHOLD;

  const previousDraft = {
    title: previousContent.title,
    summary: previousContent.summary,
    skills: previousContent.skills,
    experiences: previousContent.experiences.map((e) =>
      isProjectLayout(previousContent.layout) || e.projects?.length
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
  };

  return [
    `ATS TARGETED REVISION — previous score ${feedback.overall}/${ATS_SCORE_MAX}. Target: ${targetScore}+.`,
    rulesGuarded &&
      `RULE GUARD ACTIVE (rule keep ${ruleKeepFeedback!.overall}/${RULE_KEEP_SCORE_MAX}): add missing keywords ONLY to the title line and skills line. Do NOT edit summary or experience bullets for ATS — those fields are protected to preserve rule compliance.`,
    `IMPORTANT: Do NOT rewrite the entire resume. Use the previous draft below as your base.`,
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
  const passed = feedback.rules.filter((r) => r.passed);

  return [
    `RULE KEEP REVISION — previous score ${feedback.overall}/${RULE_KEEP_SCORE_MAX} (${feedback.passedRules}/${feedback.totalRules} rules passed). Target: ${targetScore}+.`,
    `RULE FLOOR (absolute): Rule keep MUST stay at or above ${feedback.overall}. No ATS or tone gain is worth breaking a passing rule.`,
    `Previous rule summary: ${feedback.summary}`,
    passed.length > 0 &&
      `Passing rules — do NOT edit any text that satisfies these (return those fields verbatim):\n${passed
        .slice(0, 12)
        .map((r, index) => `- Rule ${index + 1} [${r.category}]: ${r.detail}`)
        .join("\n")}${passed.length > 12 ? `\n- …and ${passed.length - 12} more passing rules` : ""}`,
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

  const rulesGuarded =
    rulesActive && ruleKeepFeedback!.overall >= RULE_KEEP_GUARD_THRESHOLD;

  const lines = [
    "SURGICAL EDIT PLAN (mandatory) — edit ONLY the zones below. All other fields stay verbatim from the previous draft.",
  ];

  if (rulesGuarded) {
    lines.push(
      `RULE GUARD (${ruleKeepFeedback!.overall}/${RULE_KEEP_SCORE_MAX}): summary and ALL experience bullets are LOCKED for ATS/tone edits. Only title and skills may change for keywords. Tone fixes must be in-place word swaps inside bullets only when they do not break any passing rule.`
    );
  }

  if (atsFeedback && !atsPassing) {
    lines.push(
      rulesGuarded
        ? `ATS is below target (${atsFeedback.overall}) — add missing keywords ONLY to title and skills. Do NOT modify summary or bullets.`
        : `ATS is below target (${atsFeedback.overall}) — edit ONLY: title, skills, summary (max one clause), and bullets missing keywords. Prefer skills/title first.`
    );
  } else if (atsFeedback) {
    lines.push(
      `ATS is already strong (${atsFeedback.overall}) — do NOT rephrase title, skills, or summary for keywords. Keep matched keywords exactly as written.`
    );
  }

  if (humanToneFeedback && !tonePassing) {
    lines.push(
      rulesGuarded
        ? `Human tone is below target (${humanToneFeedback.overall}) — with rule guard active, prefer leaving bullets unchanged. If you must edit tone, use single-word swaps in bullets that already pass all rules; never rewrite a bullet.`
        : `Human tone is below target (${humanToneFeedback.overall}) — edit ONLY bullets with repetition, buzzwords, or weak openers. Swap verbs and add collaboration context in-place. Do NOT remove ATS keywords or metrics from edited bullets.`
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
    rulesGuarded
      ? `Conflict resolution: rule keep wins over ATS and tone. With rule guard active, ATS keywords go in title/skills only; do not edit summary or bullets unless fixing a specific failed rule in that field.`
      : `Conflict resolution: if improving one score would hurt another, use this order — (1) preserve passing rules, (2) skills/title for ATS keywords, (3) in-place bullet word swaps for tone, (4) smallest rule fix in the cited field only. Never replace a full bullet or summary paragraph.`
  );

  return lines.join("\n\n");
}

function formatTemplateExperienceLine(
  e: GeneratedResumeContent["experiences"][number],
  index: number,
  layout: ResumeTemplateLayout,
  mode: "template" | "regenerate"
): string {
  const prefix = `${index + 1}. company="${e.company}" (FIXED) | dates="${e.dates}" (FIXED) | template role="${e.role}"`;
  if (isProjectLayout(layout) || e.projects?.length) {
    const projects = e.projects ?? [];
    const projectList = projects
      .map((p, i) => `project ${i + 1} name="${p.name}" (FIXED)`)
      .join("; ");
    const verb =
      mode === "regenerate"
        ? `rewrite role + BAR field values for ${projects.length} projects (JD-tailored)`
        : `rewrite role for JD; rewrite BAR values for all ${projects.length} projects`;
    return `${prefix} | ${projectList} | ${verb}`;
  }
  const count = e.bullets.length;
  const verb =
    mode === "regenerate"
      ? `rewrite role if needed; bullets: keep ${count}, change only for ATS/tone gaps`
      : `rewrite role for JD; rewrite all ${count} bullets`;
  return `${prefix} | ${verb}`;
}

export function buildResumeUserPrompt({
  jobTitle,
  companyName,
  jobDescription,
  customPrompt,
  headerTitle,
  existingExperiences,
  templateLayout = "bullets",
  atsFeedback,
  humanToneFeedback,
  ruleKeepFeedback,
  previousContent,
  templateSamples,
}: {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  customPrompt: string;
  headerTitle: string;
  existingExperiences: GeneratedResumeContent["experiences"];
  templateLayout?: ResumeTemplateLayout;
  atsFeedback?: AtsScoreResult;
  humanToneFeedback?: HumanToneScoreResult;
  ruleKeepFeedback?: RuleKeepScoreResult;
  previousContent?: GeneratedResumeContent;
  templateSamples?: TemplateContentSamples;
}): string {
  const isRegenerate = Boolean(previousContent && atsFeedback);
  const layout = previousContent?.layout ?? templateLayout;
  const projectMode = isProjectLayout(layout);

  const experienceInstructions = isRegenerate
    ? `Previous draft companies (${previousContent!.experiences.length} required — copy company, role, dates exactly from previous draft; keep same ${projectMode ? "project" : "bullet"} count per company; revise ${projectMode ? "project fields" : "bullets"} only where ATS or human-tone feedback requires):\n${previousContent!.experiences
        .map((e, i) => formatTemplateExperienceLine(e, i, layout, "regenerate"))
        .join("\n")}`
    : `Template companies (${existingExperiences.length} required — copy company, role, dates exactly into each JSON experience object):\n${existingExperiences
        .map((e, i) => formatTemplateExperienceLine(e, i, layout, "template"))
        .join("\n")}`;

  const closingInstruction = isRegenerate
    ? `Return exactly ${previousContent!.experiences.length} objects in experiences[]. Surgical triple-target revision only — improve weak scores using the edit zones above; leave all other text unchanged. Return valid json only.`
    : `Return exactly ${existingExperiences.length} objects in experiences[]. Rewrite title, summary, skills, and ${projectMode ? "project BAR fields" : "bullets"} only. Return valid json only.`;

  const surgicalPlan =
    isRegenerate &&
    buildSurgicalEditPlanSection(atsFeedback, humanToneFeedback, ruleKeepFeedback);

  return [
    jobTitle && `Target job title: ${jobTitle}`,
    `Target company: ${companyName}`,
    jobDescription && `Job description:\n${jobDescription}`,
    !isRegenerate && buildTemplateStyleSection(templateSamples),
    customPrompt && `Additional instructions:\n${customPrompt}`,
    headerTitle && `Current resume title line: ${headerTitle}`,
    experienceInstructions,
    surgicalPlan,
    ruleKeepFeedback && buildRuleKeepRegeneratePromptSection(ruleKeepFeedback),
    atsFeedback &&
      previousContent &&
      buildAtsRegeneratePromptSection(atsFeedback, previousContent, ATS_PASS_THRESHOLD, ruleKeepFeedback),
    humanToneFeedback && buildHumanToneRegeneratePromptSection(humanToneFeedback),
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

export function parseResumeJsonContent(
  raw: string,
  layout: ResumeTemplateLayout = "bullets"
): GeneratedResumeContent {
  const jsonText = extractResumeJsonRaw(raw);
  if (!jsonText) {
    throw new Error("AI returned no resume content. Please try again.");
  }

  const parsed = tryParseResumeJson(jsonText);
  if (!parsed) {
    throw new Error("AI returned invalid JSON. Try again or shorten the job description.");
  }

  const projectMode = isProjectLayout(layout);

  return {
    title: String(parsed.title).trim(),
    summary: String(parsed.summary).trim(),
    skills: String(parsed.skills).trim(),
    layout: projectMode ? "projects" : "bullets",
    experiences: parsed.experiences.map((e) =>
      normalizeResumeExperience(
        projectMode
          ? {
              company: e.company,
              role: e.role,
              dates: e.dates,
              bullets: [],
              projects: (e.projects ?? []).map((p) => normalizeResumeProject(p)),
            }
          : {
              company: e.company,
              role: e.role,
              dates: e.dates,
              bullets: (e.bullets ?? []).map((b) => String(b).trim()).filter(Boolean),
            },
        layout
      )
    ),
  };
}

function matchExperienceByCompany(
  parsedExperiences: GeneratedResumeContent["experiences"],
  existing: GeneratedResumeContent["experiences"][number],
  index: number,
  layout: ResumeTemplateLayout
) {
  const byIndex = parsedExperiences[index];
  const projectMode = isProjectLayout(layout) || (existing.projects?.length ?? 0) > 0;
  if (projectMode ? byIndex?.projects?.length : byIndex?.bullets?.length) return byIndex;

  const key = existing.company.toLowerCase();
  return parsedExperiences.find(
    (e) =>
      e.company.toLowerCase().includes(key) ||
      key.includes(e.company.toLowerCase()) ||
      e.role.toLowerCase().includes(key)
  );
}

function normalizeProjectsToCount(
  projects: GeneratedResumeContent["experiences"][number]["projects"],
  targetCount: number,
  fallback: NonNullable<GeneratedResumeContent["experiences"][number]["projects"]>
) {
  const normalized = (projects ?? []).map((p) => normalizeResumeProject(p));
  if (targetCount <= 0) return [];
  if (normalized.length === targetCount) return normalized;
  if (normalized.length > targetCount) return normalized.slice(0, targetCount);
  const out = [...normalized];
  while (out.length < targetCount) {
    out.push(normalizeResumeProject(fallback[out.length] ?? fallback[fallback.length - 1]));
  }
  return out;
}

export function mergeResumeWithTemplate(
  parsed: GeneratedResumeContent,
  existingExperiences: GeneratedResumeContent["experiences"],
  fallbackTitle: string,
  layout: ResumeTemplateLayout = "bullets"
): GeneratedResumeContent {
  const projectMode = isProjectLayout(layout);

  return {
    title: parsed.title || fallbackTitle,
    summary: parsed.summary,
    skills: parsed.skills,
    layout: projectMode ? "projects" : "bullets",
    experiences: existingExperiences.map((existing, i) => {
      const generated = matchExperienceByCompany(parsed.experiences, existing, i, layout);

      if (projectMode || existing.projects?.length) {
        const projects = normalizeProjectsToCount(
          generated?.projects,
          existing.projects?.length ?? 0,
          existing.projects ?? []
        ).map((project, projectIndex) => {
          const templateProject = existing.projects?.[projectIndex];
          return {
            name: templateProject?.name ?? project.name,
            businessChallenge:
              project.businessChallenge || templateProject?.businessChallenge || "",
            assignedResponsibility:
              project.assignedResponsibility || templateProject?.assignedResponsibility || "",
            action: project.action || templateProject?.action || "",
            result: project.result || templateProject?.result || "",
          };
        });

        return {
          company: existing.company,
          role: generated?.role?.trim() || existing.role,
          dates: existing.dates,
          bullets: [],
          projects,
        };
      }

      const bullets = generated?.bullets?.length ? generated.bullets : existing.bullets;
      const target = existing.bullets.length;
      const normalized =
        bullets.length === target
          ? bullets
          : bullets.length > target
            ? bullets.slice(0, target)
            : [...bullets, ...existing.bullets.slice(bullets.length, target)];

      return {
        company: existing.company,
        role: generated?.role?.trim() || existing.role,
        dates: existing.dates,
        bullets: normalized,
      };
    }),
  };
}

export function finalizeResumeContent(
  modelText: string,
  existingExperiences: GeneratedResumeContent["experiences"],
  fallbackTitle: string,
  layout: ResumeTemplateLayout = "bullets"
): GeneratedResumeContent {
  const parsed = parseResumeJsonContent(modelText, layout);
  const merged = mergeResumeWithTemplate(parsed, existingExperiences, fallbackTitle, layout);
  return applyResumeContentPostProcess(merged, existingExperiences, layout);
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
  if (/"projects"/.test(text) || /"businessChallenge"/.test(text)) return "experiences";
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
  experiences: "Tailoring experience content",
  finalizing: "Finalizing your draft",
};
