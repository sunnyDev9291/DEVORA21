import { completeDeepSeek } from "@/lib/deepseek-stream";
import type { GeneratedResumeContent } from "@/lib/resume-types";
import {
  extractExperienceSectionPlainText,
  parseExperiencesFromDocxBuffer,
  validateParsedExperiences,
} from "@/lib/resume-docx";

const AI_PARSE_SYSTEM = `You extract work experience from resume text.
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

export async function parseExperiencesWithAI(
  buffer: Buffer
): Promise<GeneratedResumeContent["experiences"]> {
  const sectionText = extractExperienceSectionPlainText(buffer);
  if (!sectionText.trim()) {
    throw new Error("Experience section is empty or missing.");
  }

  const raw = await completeDeepSeek(
    [
      { role: "system", content: AI_PARSE_SYSTEM },
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

  return parsed.experiences.map((e) => ({
    company: String(e.company ?? "").trim(),
    role: String(e.role ?? "").trim(),
    dates: String(e.dates ?? "").trim(),
    bullets: (e.bullets ?? []).map((b) => String(b).trim()).filter(Boolean),
  }));
}

/** Structural Word parse first; AI fallback when validation fails. */
export async function resolveExperiencesFromDocx(
  buffer: Buffer
): Promise<GeneratedResumeContent["experiences"]> {
  const structural = parseExperiencesFromDocxBuffer(buffer);
  const structuralCheck = validateParsedExperiences(structural);
  if (structuralCheck.ok) return structural;

  try {
    const aiParsed = await parseExperiencesWithAI(buffer);
    const aiCheck = validateParsedExperiences(aiParsed);
    if (aiCheck.ok) return aiParsed;
    throw new Error(aiCheck.errors.join(" "));
  } catch (err) {
    const detail = err instanceof Error ? err.message : "AI parse failed";
    throw new Error(
      structuralCheck.errors.length
        ? `Template parse failed (${structuralCheck.errors.join("; ")}). ${detail}`
        : detail
    );
  }
}
