import { applyResumeContentPostProcess } from "@/lib/resume-content-postprocess";
import { isProjectLayout, normalizeResumeExperience, normalizeResumeProject } from "@/lib/resume-experience-utils";
import { buildRegenerationEvaluationBlock } from "@/lib/resume-regenerate-prompt";
import { emptyRuleKeepScore } from "@/lib/resume-rule-keep";
import { buildUnifiedResumeScore } from "@/lib/resume-unified-score";
import type { AtsScoreResult, GeneratedResumeContent, ResumeTemplateLayout, RuleKeepScoreResult } from "@/lib/resume-types";

export const RESUME_AI_MODEL = "deepseek-v4-pro";

export const RESUME_MAX_TOKENS = 16384;

const BULLETS_JSON_SHAPE = `{
  "title": "string",
  "summary": "string",
  "skills": "string",
  "experiences": [
    { "company": "string", "role": "string", "dates": "string", "bullets": ["string"] }
  ]
}`;

const PROJECTS_JSON_SHAPE = `{
  "title": "string",
  "summary": "string",
  "skills": "string",
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
export function buildResumeSystemPrompt(_regenerate = false, layout: ResumeTemplateLayout = "bullets"): string {
  const shape = isProjectLayout(layout) ? PROJECTS_JSON_SHAPE : BULLETS_JSON_SHAPE;
  return [
    "Return ONLY valid JSON matching this shape:",
    shape,
    "",
    "Technical output rules (not content style):",
    "- Use **double asterisks** around skill category labels (e.g. **Languages:**) and tech terms so Word can render bold.",
    "- Match the template job count, dates, project/bullet counts, and fixed project names from the user message.",
    "- Do not invent employers or projects.",
    "- All wording, tone, and formatting rules come ONLY from the user Instructions in the user message.",
    "- No markdown fences or commentary.",
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
}: {
  jobTitle: string;
  jobDescription: string;
  customPrompt: string;
  existingExperiences: GeneratedResumeContent["experiences"];
  templateLayout?: ResumeTemplateLayout;
  previousContent?: GeneratedResumeContent;
  atsFeedback?: AtsScoreResult;
  ruleKeepFeedback?: RuleKeepScoreResult;
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
          JSON.stringify(
            {
              title: previousContent.title,
              summary: previousContent.summary,
              skills: previousContent.skills,
              experiences: previousContent.experiences,
            },
            null,
            2
          ),
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

  return [
    jobTitle && `Job title:\n${jobTitle}`,
    jobDescription && `Job description:\n${jobDescription}`,
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
