import { applyResumeContentPostProcess } from "@/lib/resume-content-postprocess";
import { buildTemplateSkillsPromptBlock } from "@/lib/resume-skills-style";
import { isProjectLayout, normalizeResumeExperience, normalizeResumeProject } from "@/lib/resume-experience-utils";
import type {
  GeneratedResumeContent,
  ResumeProject,
  ResumeTemplateLayout,
} from "@/lib/resume-types";

export const RESUME_AI_MODEL = "claude-sonnet-4-6";

/** Resume generation streams with this budget (full multi-role JSON needs headroom). */
export const RESUME_MAX_TOKENS = 16384;

const BULLETS_JSON_SHAPE = `{
  "title": "string",
  "summary": "string",
  "skills": "string",
  "fileName": "string",
  "education": { "degree": "string", "university": "string", "period": "string" },
  "experiences": [
    { "company": "string", "role": "string", "dates": "string", "location": "string", "bullets": ["string"] }
  ]
}`;

const PROJECTS_JSON_SHAPE = `{
  "title": "string",
  "summary": "string",
  "skills": "string",
  "fileName": "string",
  "education": { "degree": "string", "university": "string", "period": "string" },
  "experiences": [
    {
      "company": "string",
      "role": "string",
      "dates": "string",
      "location": "string",
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
  const regenerateRules = regenerate
    ? [
        "- REGENERATE MODE: Start from the previous draft JSON in the user message.",
        "- Copy every unchanged field verbatim from the previous draft (same wording, punctuation, and formatting).",
        "- Only rewrite fields needed for the Task, if a Task is present.",
      ]
    : [];
  return [
    "Return ONLY valid JSON matching this shape:",
    shape,
    "",
    "Technical output rules (not content style):",
    "- Use **double asterisks** around skill category labels (e.g. **Languages:**) and tech terms so Word can render bold.",
    "- skills MUST be one string with lines like \"**Category:** item1, item2\" (not a JSON array).",
    "- STYLE-ONLY TEMPLATES: company, role, dates, location, and bullets/projects MUST come from Writing instructions / career history / job fit — NOT from Word section headers.",
    "- ABSOLUTE: Writing instructions alone control skill category count, category names/order, items per category, bullet count per job, and bullet word counts.",
    "- Include education when Writing instructions or profile imply it.",
    "- No markdown fences or commentary.",
    ...regenerateRules,
  ].join("\n");
}

export function buildResumeUserPrompt({
  jobTitle,
  companyName,
  jobDescription,
  templateLayout = "bullets",
  previousContent,
  templateSkillsSample,
  task,
  writingInstructions,
}: {
  jobTitle: string;
  companyName?: string;
  jobDescription: string;
  templateLayout?: ResumeTemplateLayout;
  previousContent?: GeneratedResumeContent;
  /** Optional skills sample from DOCX (category label style only). */
  templateSkillsSample?: string;
  task?: string;
  writingInstructions?: string;
}): string {
  const layout = previousContent?.layout ?? templateLayout;
  const isRegenerate = Boolean(previousContent);

  const previousDraftBlock =
    isRegenerate && previousContent
      ? [
          "Previous draft JSON (revise this document; keep unchanged fields verbatim):",
          JSON.stringify({
            title: previousContent.title,
            summary: previousContent.summary,
            skills: previousContent.skills,
            fileName: previousContent.fileName,
            education: previousContent.education,
            experiences: previousContent.experiences,
          }),
          `Prefer about ${Math.max(previousContent.experiences.length, 1)} experience entries unless Writing instructions say otherwise.`,
        ].join("\n")
      : [
          "STYLE MODE: Template is Word styles/slots only — not a content source.",
          "Build experiences[] from Writing instructions / career history with company, role, dates, location, and bullets.",
          "Choose a sensible job count from Writing instructions (typically 2–4).",
        ].join("\n");

  const templateSkillsBlock = buildTemplateSkillsPromptBlock(templateSkillsSample ?? "", layout);
  const taskBlock = task?.trim() ? `Task:\n${task.trim()}` : "";
  const writingBlock = writingInstructions?.trim()
    ? [
        "Writing instructions (ABSOLUTE source of truth for tone, skill categories/counts/items, bullet count, bullet word count, employers/dates, and formatting — follow exactly):",
        writingInstructions.trim(),
        "Ignore DOCX visual section labels (Work History, Technical Skills, etc.) — they are not content sources.",
      ].join("\n")
    : "";

  return [
    writingBlock,
    jobTitle && `Job title:\n${jobTitle}`,
    companyName?.trim() && `Company:\n${companyName.trim()}`,
    jobDescription && `Job description:\n${jobDescription}`,
    templateSkillsBlock,
    taskBlock,
    previousDraftBlock,
    "Return a non-empty experiences array. Valid JSON only.",
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
  education?: unknown;
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
  location?: string;
  bullets: string[];
  projects?: Array<Partial<ResumeProject>>;
} | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const exp = raw as Record<string, unknown>;
  const company = String(exp.company ?? "").trim();
  const role = String(exp.role ?? exp.title ?? "").trim();
  const dates = String(exp.dates ?? exp.date ?? "").trim();
  const location = String(exp.location ?? exp.workplace ?? exp.workLocation ?? "").trim();
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
  return {
    company,
    role,
    dates,
    ...(location ? { location } : {}),
    bullets,
    ...(projects ? { projects } : {}),
  };
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

  let education: GeneratedResumeContent["education"];
  if (obj.education && typeof obj.education === "object" && !Array.isArray(obj.education)) {
    const edu = obj.education as { degree?: unknown; university?: unknown; period?: unknown };
    const degree = String(edu.degree ?? "").trim();
    const university = String(edu.university ?? "").trim();
    const period = String(edu.period ?? "").trim();
    if (degree || university || period) {
      education = {
        ...(degree ? { degree } : {}),
        ...(university ? { university } : {}),
        ...(period ? { period } : {}),
      };
    }
  }

  // Accept partial/truncated payloads: summary or at least one experience is enough to merge.
  if (!summary && experiences.length === 0) return null;

  return {
    title: title || experiences[0]?.role || "Resume",
    summary,
    skills,
    ...(fileName ? { fileName } : {}),
    ...(education ? { education } : {}),
    experiences: experiences.map((e) => ({
      company: e.company,
      role: e.role,
      dates: e.dates,
      ...(e.location ? { location: e.location } : {}),
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
  const educationRaw =
    parsed.education && typeof parsed.education === "object"
      ? (parsed.education as { degree?: string; university?: string; period?: string })
      : undefined;
  const education =
    educationRaw &&
    (educationRaw.degree?.trim() || educationRaw.university?.trim() || educationRaw.period?.trim())
      ? {
          ...(educationRaw.degree?.trim() ? { degree: String(educationRaw.degree).trim() } : {}),
          ...(educationRaw.university?.trim()
            ? { university: String(educationRaw.university).trim() }
            : {}),
          ...(educationRaw.period?.trim() ? { period: String(educationRaw.period).trim() } : {}),
        }
      : undefined;

  return {
    title: String(parsed.title).trim(),
    summary: String(parsed.summary).trim(),
    skills: String(parsed.skills).trim(),
    ...(fileName ? { fileName } : {}),
    ...(education ? { education } : {}),
    layout: projectMode ? "projects" : "bullets",
    experiences: parsed.experiences.map((e) =>
      normalizeResumeExperience(
        projectMode
          ? {
              company: e.company,
              role: e.role,
              dates: e.dates,
              location: e.location,
              bullets: [],
              projects: (e.projects ?? []).map((p) => normalizeResumeProject(p)),
            }
          : {
              company: e.company,
              role: e.role,
              dates: e.dates,
              location: e.location,
              bullets: (e.bullets ?? []).map((b) => String(b).trim()).filter(Boolean),
            },
        layout
      )
    ),
  };
}

function normalizeCompareText(text: string): string {
  return text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Prefer AI text; if empty or identical to previous draft, keep previous wording. */
export function pickRegenerateText(aiText: string, previousText?: string): string {
  const ai = aiText.trim();
  const previous = (previousText ?? "").trim();
  if (!ai) return previous;
  if (previous && normalizeCompareText(ai) === normalizeCompareText(previous)) return previous;
  return ai;
}

function pickEducation(
  parsed: GeneratedResumeContent["education"],
  previous: GeneratedResumeContent["education"]
): GeneratedResumeContent["education"] | undefined {
  if (!parsed && !previous) return undefined;
  const degree = pickRegenerateText(parsed?.degree ?? "", previous?.degree);
  const university = pickRegenerateText(parsed?.university ?? "", previous?.university);
  const period = pickRegenerateText(parsed?.period ?? "", previous?.period);
  if (!degree && !university && !period) return undefined;
  return {
    ...(degree ? { degree } : {}),
    ...(university ? { university } : {}),
    ...(period ? { period } : {}),
  };
}

/**
 * Style-only merge: AI JSON is the source of truth.
 * `previousContent` is only used on improve/regenerate to preserve unchanged wording.
 * DOCX-parsed employers are never used.
 */
export function mergeResumeContent(
  parsed: GeneratedResumeContent,
  fallbackTitle: string,
  layout: ResumeTemplateLayout = "bullets",
  previous?: GeneratedResumeContent | null
): GeneratedResumeContent {
  const projectMode = isProjectLayout(layout);
  const experiences = parsed.experiences.length
    ? parsed.experiences
    : previous?.experiences ?? [];

  const education = pickEducation(parsed.education, previous?.education);

  return {
    title: pickRegenerateText(parsed.title || fallbackTitle, previous?.title) || fallbackTitle,
    summary: pickRegenerateText(parsed.summary, previous?.summary),
    skills: pickRegenerateText(parsed.skills, previous?.skills),
    ...(parsed.fileName?.trim()
      ? { fileName: parsed.fileName.trim() }
      : previous?.fileName?.trim()
        ? { fileName: previous.fileName.trim() }
        : {}),
    ...(education ? { education } : {}),
    layout: projectMode ? "projects" : "bullets",
    experiences: experiences.map((exp, index) => {
      const prev = previous?.experiences[index];

      if (projectMode || exp.projects?.length || prev?.projects?.length) {
        const projects = (exp.projects?.length ? exp.projects : prev?.projects ?? []).map(
          (project, projectIndex) => {
            const prevProject = prev?.projects?.[projectIndex];
            return {
              name: pickRegenerateText(project.name, prevProject?.name),
              businessChallenge: pickRegenerateText(
                project.businessChallenge,
                prevProject?.businessChallenge
              ),
              assignedResponsibility: pickRegenerateText(
                project.assignedResponsibility,
                prevProject?.assignedResponsibility
              ),
              action: pickRegenerateText(project.action, prevProject?.action),
              result: pickRegenerateText(project.result, prevProject?.result),
            };
          }
        );
        const location = pickRegenerateText(exp.location ?? "", prev?.location);
        return {
          company: pickRegenerateText(exp.company, prev?.company),
          role: pickRegenerateText(exp.role, prev?.role),
          dates: pickRegenerateText(exp.dates, prev?.dates),
          ...(location ? { location } : {}),
          bullets: [],
          projects,
        };
      }

      const bullets = (exp.bullets?.length ? exp.bullets : prev?.bullets ?? []).map(
        (bullet, bulletIndex) => pickRegenerateText(bullet, prev?.bullets?.[bulletIndex])
      );
      const location = pickRegenerateText(exp.location ?? "", prev?.location);
      return {
        company: pickRegenerateText(exp.company, prev?.company),
        role: pickRegenerateText(exp.role, prev?.role),
        dates: pickRegenerateText(exp.dates, prev?.dates),
        ...(location ? { location } : {}),
        bullets,
      };
    }),
  };
}

/** @deprecated Use mergeResumeContent — name kept for older call sites. */
export function mergeResumeWithTemplate(
  parsed: GeneratedResumeContent,
  _unusedExperiences: GeneratedResumeContent["experiences"],
  fallbackTitle: string,
  layout: ResumeTemplateLayout = "bullets",
  baseline?: GeneratedResumeContent | null
): GeneratedResumeContent {
  return mergeResumeContent(parsed, fallbackTitle, layout, baseline);
}

export type FinalizeResumeOptions = {
  fallbackTitle: string;
  layout?: ResumeTemplateLayout;
  previousContent?: GeneratedResumeContent | null;
  skillsSample?: string;
};

export function finalizeResumeContent(
  modelText: string,
  options: FinalizeResumeOptions
): GeneratedResumeContent {
  const layout = options.layout ?? "bullets";
  const parsed = parseResumeJsonContent(modelText, layout);
  const merged = mergeResumeContent(
    parsed,
    options.fallbackTitle,
    layout,
    options.previousContent
  );
  return applyResumeContentPostProcess(merged, layout, options.skillsSample);
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
