import { completeDeepSeek } from "@/lib/deepseek-stream";
import { detectResumeTemplateLayout, parseTemplateContentSamples } from "@/lib/resume-docx";
import {
  parseProjectExperiencesFromDocxBuffer,
  validateParsedProjectExperiences,
} from "@/lib/resume-docx-project";
import type { GeneratedResumeContent, ResumeTemplateLayout } from "@/lib/resume-types";
import {
  extractExperienceSectionPlainText,
  parseExperiencesFromDocxBuffer,
  validateParsedExperiences,
} from "@/lib/resume-docx";

const AI_PARSE_BULLETS_SYSTEM = `You extract work experience from resume text.
Return ONLY valid json:
{
  "experiences": [
    { "company": "string", "role": "string", "dates": "string", "bullets": ["string"] }
  ]
}

Rules:
- company = employer name only (short, never a bullet sentence)
- role = job title
- dates = employment range exactly as written (e.g. "08/2023 – 02/2025")
- bullets = achievement lines only, no company/role/date lines
- preserve order from top to bottom
- do not invent employers`;

const AI_PARSE_PROJECTS_SYSTEM = `You extract work experience from resume text that uses project blocks (not bullets).
Return ONLY valid json:
{
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
}

Rules:
- company = employer name only
- role = job title
- dates = employment range exactly as written
- Each project block has: name, business need/challenge, responsibility, work/action, result
- Labels may appear as "Project:", "Business Challenge:", "Business Need:", "Work and Business Need:", "Assigned Responsibility:", "Responsibility:", "Action:", "Work:", "Word:", "Result:" — extract values only
- preserve order from top to bottom
- do not invent employers or projects`;

export type TemplateParseResult = {
  layout: ResumeTemplateLayout;
  experiences: GeneratedResumeContent["experiences"];
  /** Skillsets section from the template — used for style matching. */
  skillsSample: string;
};

async function parseExperiencesWithAI(
  buffer: Buffer,
  layout: ResumeTemplateLayout
): Promise<GeneratedResumeContent["experiences"]> {
  const sectionText = extractExperienceSectionPlainText(buffer);
  if (!sectionText.trim()) {
    throw new Error("Experience section is empty or missing.");
  }

  const system =
    layout === "projects" ? AI_PARSE_PROJECTS_SYSTEM : AI_PARSE_BULLETS_SYSTEM;

  const raw = await completeDeepSeek(
    [
      { role: "system", content: system },
      {
        role: "user",
        content: `Extract all jobs from this EXPERIENCE section:\n\n${sectionText}`,
      },
    ],
    4096,
    { jsonObject: true }
  );

  let parsed: { experiences?: GeneratedResumeContent["experiences"] };
  try {
    parsed = JSON.parse(raw) as { experiences?: GeneratedResumeContent["experiences"] };
  } catch {
    throw new Error("AI could not parse the template experience section.");
  }

  if (!Array.isArray(parsed.experiences) || parsed.experiences.length === 0) {
    throw new Error("AI found no experience entries in the template.");
  }

  if (layout === "projects") {
    return parsed.experiences.map((e) => ({
      company: String(e.company ?? "").trim(),
      role: String(e.role ?? "").trim(),
      dates: String(e.dates ?? "").trim(),
      bullets: [],
      projects: (e.projects ?? []).map((p) => ({
        name: String(p.name ?? "").trim(),
        businessChallenge: String(p.businessChallenge ?? "").trim(),
        assignedResponsibility: String(p.assignedResponsibility ?? "").trim(),
        action: String(p.action ?? "").trim(),
        result: String(p.result ?? "").trim(),
      })),
    }));
  }

  return parsed.experiences.map((e) => ({
    company: String(e.company ?? "").trim(),
    role: String(e.role ?? "").trim(),
    dates: String(e.dates ?? "").trim(),
    bullets: (e.bullets ?? []).map((b) => String(b).trim()).filter(Boolean),
  }));
}

function validateByLayout(
  layout: ResumeTemplateLayout,
  experiences: GeneratedResumeContent["experiences"]
) {
  return layout === "projects"
    ? validateParsedProjectExperiences(experiences)
    : validateParsedExperiences(experiences);
}

function parseStructural(
  buffer: Buffer,
  layout: ResumeTemplateLayout
): GeneratedResumeContent["experiences"] {
  if (layout === "projects") {
    return parseProjectExperiencesFromDocxBuffer(buffer).experiences;
  }
  return parseExperiencesFromDocxBuffer(buffer);
}

/** Fast structural parse from the current DOCX bytes — always use for build/apply. */
export function parseTemplateStructureSync(buffer: Buffer): TemplateParseResult & { valid: boolean } {
  const layout = detectResumeTemplateLayout(buffer);
  const skillsSample = parseTemplateContentSamples(buffer).skills;
  const experiences = parseStructural(buffer, layout);
  const valid = validateByLayout(layout, experiences).ok;
  return { layout, experiences, skillsSample, valid };
}

/** Structural Word parse first; AI fallback when validation fails. */
export async function resolveTemplateFromDocx(buffer: Buffer): Promise<TemplateParseResult> {
  const structural = parseTemplateStructureSync(buffer);
  if (structural.valid) {
    return {
      layout: structural.layout,
      experiences: structural.experiences,
      skillsSample: structural.skillsSample,
    };
  }

  const structuralCheck = validateByLayout(structural.layout, structural.experiences);

  try {
    const aiParsed = await parseExperiencesWithAI(buffer, structural.layout);
    const aiCheck = validateByLayout(structural.layout, aiParsed);
    if (aiCheck.ok) {
      return { layout: structural.layout, experiences: aiParsed, skillsSample: structural.skillsSample };
    }
    throw new Error(aiCheck.errors.join(" "));
  } catch (err) {
    const detail = err instanceof Error ? err.message : "AI parse failed";
    const structuralErrors = !structuralCheck.ok ? structuralCheck.errors : [];
    throw new Error(
      structuralErrors.length
        ? `Template parse failed (${structuralErrors.join("; ")}). ${detail}`
        : detail
    );
  }
}

/** @deprecated Use resolveTemplateFromDocx — experiences only. */
export async function resolveExperiencesFromDocx(
  buffer: Buffer
): Promise<GeneratedResumeContent["experiences"]> {
  const { experiences } = await resolveTemplateFromDocx(buffer);
  return experiences;
}
