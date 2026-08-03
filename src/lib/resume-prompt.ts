import { applyResumeContentPostProcess } from "@/lib/resume-content-postprocess";
import { extractResumeFileNamePatternFromPrompt } from "@/lib/resume-filename";
import { buildTemplateSkillsPromptBlock } from "@/lib/resume-skills-style";
import { isProjectLayout, normalizeResumeExperience, normalizeResumeProject } from "@/lib/resume-experience-utils";
import { buildRegenerationEvaluationBlock } from "@/lib/resume-regenerate-prompt";
import { emptyRuleKeepScore } from "@/lib/resume-rule-keep";
import { buildUnifiedResumeScore } from "@/lib/resume-unified-score";
import type { AtsScoreResult, GeneratedResumeContent, ResumeProject, ResumeTemplateLayout, RuleKeepScoreResult } from "@/lib/resume-types";

export const RESUME_AI_MODEL = "claude-sonnet-4-6";

/** Resume generation streams with this budget (full multi-role JSON needs headroom). */
export const RESUME_MAX_TOKENS = 16384;

const BULLETS_JSON_SHAPE = `{
  "title": "string",
  "summary": "string",
  "skills": "string",
  "fileName": "string",
  "experiences": [
    { "company": "string", "role": "string", "dates": "string", "bullets": ["string"] }
  ]
}`;

const PROJECTS_JSON_SHAPE = `{
  "title": "string",
  "summary": "string",
  "skills": "string",
  "fileName": "string",
  "experiences": [
    {
      "company": "string",
      "role": "string",
      "dates": "string",
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
}`;

/** Minimal system prompt — content/style rules come only from the user's instructions. */
export function buildResumeSystemPrompt(regenerate = false, layout: ResumeTemplateLayout = "bullets"): string {
  const shape = isProjectLayout(layout) ? PROJECTS_JSON_SHAPE : BULLETS_JSON_SHAPE;
  const skillRule = isProjectLayout(layout)
    ? "- Skillsets: follow the template category labels, order, line count, and colon formatting exactly; only replace the technologies."
    : "- Skillsets: follow the template plain-list style exactly; do not add category labels.";
  const regenerateRules = regenerate
    ? [
        "- REGENERATE MODE: Start from the previous draft JSON in the user message. Change only fields needed to fix weak scores.",
        "- Copy every unchanged field verbatim from the previous draft (same wording, punctuation, and formatting).",
        "- Do not rewrite high-scoring sections, summaries, or experience sentences unless the evaluation block flags them.",
      ]
    : [];
  return [
    "Return ONLY valid JSON matching this shape:",
    shape,
    "",
    "Technical output rules (not content style):",
    "- Use **double asterisks** around skill category labels (e.g. **Languages:**) and tech terms so Word can render bold.",
    "- Match the template job count, dates, project/bullet counts, and fixed project names from the user message.",
    skillRule,
    "- Set fileName when Instructions specify a resume file name (no .docx extension; substitute real values for placeholders).",
    "- Do not invent employers or projects.",
    "- All wording, tone, and formatting rules come ONLY from the user Instructions in the user message.",
    "- No markdown fences or commentary.",
    ...regenerateRules,
  ].join("\n");
}

function formatTemplateStructureLine(
  e: GeneratedResumeContent["experiences"][number],
  index: number,
  layout: ResumeTemplateLayout
): string {
  const prefix = `${index + 1}. company="${e.company}" | dates="${e.dates}"`;
  if (isProjectLayout(layout) || e.projects?.length) {
    const projects = e.projects ?? [];
    const names = projects.map((p) => `"${p.name}"`).join(", ");
    return `${prefix} | ${projects.length} project(s), fixed names: ${names}`;
  }
  return `${prefix} | ${e.bullets.length} bullet(s)`;
}

export function buildResumeUserPrompt({
  jobTitle,
  jobDescription,
  customPrompt,
  existingExperiences,
  templateLayout = "bullets",
  previousContent,
  atsFeedback,
  ruleKeepFeedback,
  priorityKeywords,
  templateSkillsSample,
}: {
  jobTitle: string;
  jobDescription: string;
  customPrompt: string;
  existingExperiences: GeneratedResumeContent["experiences"];
  templateLayout?: ResumeTemplateLayout;
  previousContent?: GeneratedResumeContent;
  atsFeedback?: AtsScoreResult;
  ruleKeepFeedback?: RuleKeepScoreResult;
  /** Must-have JD keywords — injected on first generation to improve initial ATS match. */
  priorityKeywords?: string[];
  /** Skillsets section from the user's template DOCX. */
  templateSkillsSample?: string;
}): string {
  const layout = previousContent?.layout ?? templateLayout;
  const experiences = previousContent?.experiences ?? existingExperiences;
  const isRegenerate = Boolean(previousContent);
  const instructions = customPrompt.trim();

  const structureBlock = [
    `Template structure (${experiences.length} job(s) — keep company, dates, project names, and counts fixed):`,
    experiences.map((e, i) => formatTemplateStructureLine(e, i, layout)).join("\n"),
  ].join("\n");

  const previousDraftBlock =
    isRegenerate && previousContent
      ? [
          "Previous draft (revise using only the job description and instructions above):",
          // Compact JSON — same fields as pretty-print; whitespace only (no quality change).
          JSON.stringify({
            title: previousContent.title,
            summary: previousContent.summary,
            skills: previousContent.skills,
            fileName: previousContent.fileName,
            experiences: previousContent.experiences,
          }),
        ].join("\n")
      : "";

  const evaluationBlock =
    isRegenerate && atsFeedback
      ? buildRegenerationEvaluationBlock(
          atsFeedback,
          ruleKeepFeedback ?? emptyRuleKeepScore(),
          buildUnifiedResumeScore(atsFeedback, ruleKeepFeedback ?? emptyRuleKeepScore()).overall
        )
      : "";

  const keywordBlock =
    !isRegenerate && priorityKeywords && priorityKeywords.length > 0
      ? [
          "Priority ATS keywords from the job description (include naturally in title, skills, summary, and experience):",
          priorityKeywords.slice(0, 18).join(", "),
        ].join("\n")
      : "";

  const fileNamePattern = instructions ? extractResumeFileNamePatternFromPrompt(instructions) : null;
  const fileNameBlock = fileNamePattern
    ? [
        'Resume file name (required JSON field "fileName"):',
        "Set fileName to this exact pattern with placeholders replaced using your generated title and top skills.",
        "Do not include .docx. Example shape only:",
        fileNamePattern,
      ].join("\n")
    : instructions
      ? 'If Instructions specify a resume file name, set JSON field "fileName" to that resolved name (no .docx extension).'
      : "";

  const templateSkillsBlock = buildTemplateSkillsPromptBlock(templateSkillsSample ?? "", layout);

  return [
    jobTitle && `Job title:\n${jobTitle}`,
    jobDescription && `Job description:\n${jobDescription}`,
    keywordBlock,
    templateSkillsBlock,
    fileNameBlock,
    instructions
      ? `Instructions:\n${instructions}`
      : "Instructions: Write all resume content tailored to the job description.",
    evaluationBlock,
    previousDraftBlock,
    structureBlock,
    `Return exactly ${experiences.length} experience entries. Valid JSON only.`,
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

function closeOpenJsonStructures(text: string): string {
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
  // Drop a dangling comma left after closing a truncated value.
  s = s.replace(/,\s*$/, "");
  while (brackets > 0) {
    s += "]";
    brackets -= 1;
  }
  while (braces > 0) {
    s += "}";
    braces -= 1;
  }
  s = s.replace(/,\s*([}\]])/g, "$1");
  return s;
}

/** Close truncated JSON; also try cutting back to earlier complete values. */
function repairTruncatedJsonVariants(text: string): string[] {
  const variants: string[] = [];
  const seen = new Set<string>();
  const push = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    variants.push(trimmed);
  };

  push(text);
  push(closeOpenJsonStructures(text));

  let cursor = text.trimEnd();
  for (let i = 0; i < 48 && cursor.length > 32; i += 1) {
    const cutAt = Math.max(
      cursor.lastIndexOf(","),
      cursor.lastIndexOf("}"),
      cursor.lastIndexOf("]")
    );
    if (cutAt < 16) break;
    cursor = cursor.slice(0, cutAt + (cursor[cutAt] === "," ? 0 : 1)).replace(/,\s*$/, "");
    push(closeOpenJsonStructures(cursor));
  }

  return variants;
}

type LooseResumeJson = {
  title?: unknown;
  summary?: unknown;
  skills?: unknown;
  fileName?: unknown;
  experiences?: unknown;
  experience?: unknown;
  jobTitle?: unknown;
  professionalSummary?: unknown;
  skillsets?: unknown;
};

function coerceExperienceEntry(raw: unknown): {
  company: string;
  role: string;
  dates: string;
  bullets: string[];
  projects?: Array<Partial<ResumeProject>>;
} | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const exp = raw as Record<string, unknown>;
  const company = String(exp.company ?? "").trim();
  const role = String(exp.role ?? exp.title ?? "").trim();
  const dates = String(exp.dates ?? exp.date ?? "").trim();
  const bullets = Array.isArray(exp.bullets)
    ? exp.bullets.map((b) => String(b).trim()).filter(Boolean)
    : [];

  let projects: Array<Partial<ResumeProject>> | undefined;
  if (Array.isArray(exp.projects)) {
    projects = exp.projects.filter((p) => p && typeof p === "object") as Array<Partial<ResumeProject>>;
  } else if (typeof exp.project === "string" && exp.project.trim()) {
    // Some models emit a flat "project" string — keep as a bullet so content is not lost.
    bullets.push(exp.project.trim());
  }

  if (!company && !role && bullets.length === 0 && !(projects?.length)) return null;
  return { company, role, dates, bullets, ...(projects ? { projects } : {}) };
}

function coerceResumePayload(parsed: unknown): GeneratedResumeContent | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const obj = parsed as LooseResumeJson;

  const experiencesRaw = obj.experiences ?? obj.experience;
  if (!Array.isArray(experiencesRaw)) return null;

  const experiences = experiencesRaw
    .map((entry) => coerceExperienceEntry(entry))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const title = String(obj.title ?? obj.jobTitle ?? "").trim();
  const summary = String(obj.summary ?? obj.professionalSummary ?? "").trim();
  const skills = String(obj.skills ?? obj.skillsets ?? "").trim();
  const fileName = String(obj.fileName ?? "").trim();

  // Accept partial/truncated payloads: summary or at least one experience is enough to merge.
  if (!summary && experiences.length === 0) return null;

  return {
    title: title || experiences[0]?.role || "Resume",
    summary,
    skills,
    ...(fileName ? { fileName } : {}),
    experiences: experiences.map((e) => ({
      company: e.company,
      role: e.role,
      dates: e.dates,
      bullets: e.bullets,
      ...(e.projects ? { projects: e.projects.map((p) => normalizeResumeProject(p)) } : {}),
    })),
  };
}

function tryParseResumeJson(jsonText: string): GeneratedResumeContent | null {
  for (const attempt of repairTruncatedJsonVariants(jsonText)) {
    try {
      const coerced = coerceResumePayload(JSON.parse(attempt) as unknown);
      if (coerced) return coerced;
    } catch {
      // try next variant
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

  const fileName = parsed.fileName?.trim() ? String(parsed.fileName).trim() : undefined;

  return {
    title: String(parsed.title).trim(),
    summary: String(parsed.summary).trim(),
    skills: String(parsed.skills).trim(),
    ...(fileName ? { fileName } : {}),
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

function normalizeCompareText(text: string): string {
  return text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** During regenerate, prefer the previous draft unless AI clearly changed a field. */
export function pickRegenerateText(
  aiText: string,
  baselineText: string | undefined,
  templateText: string | undefined
): string {
  const ai = aiText.trim();
  const baseline = (baselineText ?? "").trim();
  const template = (templateText ?? "").trim();

  if (!ai) return baseline || template;
  if (baseline && normalizeCompareText(ai) === normalizeCompareText(baseline)) return baseline;
  if (
    baseline &&
    template &&
    normalizeCompareText(ai) === normalizeCompareText(template) &&
    normalizeCompareText(baseline) !== normalizeCompareText(template)
  ) {
    return baseline;
  }
  return ai;
}

export function mergeResumeWithTemplate(
  parsed: GeneratedResumeContent,
  existingExperiences: GeneratedResumeContent["experiences"],
  fallbackTitle: string,
  layout: ResumeTemplateLayout = "bullets",
  baseline?: GeneratedResumeContent | null
): GeneratedResumeContent {
  const projectMode = isProjectLayout(layout);
  const baselineTitle = baseline?.title?.trim();

  return {
    title: pickRegenerateText(parsed.title || fallbackTitle, baselineTitle, fallbackTitle),
    summary: pickRegenerateText(parsed.summary, baseline?.summary, ""),
    skills: pickRegenerateText(parsed.skills, baseline?.skills, ""),
    ...(parsed.fileName?.trim()
      ? { fileName: parsed.fileName.trim() }
      : baseline?.fileName?.trim()
        ? { fileName: baseline.fileName.trim() }
        : {}),
    layout: projectMode ? "projects" : "bullets",
    experiences: existingExperiences.map((existing, i) => {
      const generated = matchExperienceByCompany(parsed.experiences, existing, i, layout);
      const baselineExp = baseline?.experiences[i];

      if (projectMode || existing.projects?.length) {
        const projects = normalizeProjectsToCount(
          generated?.projects,
          existing.projects?.length ?? 0,
          existing.projects ?? []
        ).map((project, projectIndex) => {
          const templateProject = existing.projects?.[projectIndex];
          const baselineProject = baselineExp?.projects?.[projectIndex];
          return {
            name: templateProject?.name ?? project.name,
            businessChallenge: pickRegenerateText(
              project.businessChallenge,
              baselineProject?.businessChallenge,
              templateProject?.businessChallenge
            ),
            assignedResponsibility: pickRegenerateText(
              project.assignedResponsibility,
              baselineProject?.assignedResponsibility,
              templateProject?.assignedResponsibility
            ),
            action: pickRegenerateText(project.action, baselineProject?.action, templateProject?.action),
            result: pickRegenerateText(project.result, baselineProject?.result, templateProject?.result),
          };
        });

        return {
          company: existing.company,
          role: pickRegenerateText(generated?.role ?? "", baselineExp?.role, existing.role),
          dates: existing.dates,
          bullets: [],
          projects,
        };
      }

      const sourceBullets = generated?.bullets?.length
        ? generated.bullets
        : baselineExp?.bullets?.length
          ? baselineExp.bullets
          : existing.bullets;
      const target = existing.bullets.length;
      const normalized =
        sourceBullets.length === target
          ? sourceBullets
          : sourceBullets.length > target
            ? sourceBullets.slice(0, target)
            : [...sourceBullets, ...(baselineExp?.bullets ?? existing.bullets).slice(sourceBullets.length, target)];

      const bullets = normalized.map((bullet, bulletIndex) =>
        pickRegenerateText(
          bullet,
          baselineExp?.bullets[bulletIndex],
          existing.bullets[bulletIndex]
        )
      );

      return {
        company: existing.company,
        role: pickRegenerateText(generated?.role ?? "", baselineExp?.role, existing.role),
        dates: existing.dates,
        bullets,
      };
    }),
  };
}

export function finalizeResumeContent(
  modelText: string,
  existingExperiences: GeneratedResumeContent["experiences"],
  fallbackTitle: string,
  layout: ResumeTemplateLayout = "bullets",
  baseline?: GeneratedResumeContent | null
): GeneratedResumeContent {
  const parsed = parseResumeJsonContent(modelText, layout);
  const merged = mergeResumeWithTemplate(parsed, existingExperiences, fallbackTitle, layout, baseline);
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
  if (/"bullets"/.test(text) || /"experiences?"\s*:\s*\[/.test(text)) return "experiences";
  if (/"skills"/.test(text)) return "skills";
  if (/"summary"/.test(text)) return "summary";
  if (/"title"/.test(text)) return "title";
  if (thinking.length > 40 || output.length > 8) return "analyzing";
  return "starting";
}

export const RESUME_PHASE_LABELS: Record<ResumeGenerationPhase, string> = {
  starting: "Preparing your request",
  analyzing: "Analyzing job & template",
  title: "Crafting resume title",
  summary: "Writing professional summary",
  skills: "Building skillsets",
  experiences: "Tailoring experience content",
  finalizing: "Finalizing your draft",
};
