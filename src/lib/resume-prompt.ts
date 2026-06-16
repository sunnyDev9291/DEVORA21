import type { GeneratedResumeContent } from "@/lib/resume-types";

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

export function buildResumeUserPrompt({
  jobTitle,
  companyName,
  jobDescription,
  customPrompt,
  headerTitle,
  existingExperiences,
}: {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  customPrompt: string;
  headerTitle: string;
  existingExperiences: GeneratedResumeContent["experiences"];
}): string {
  return [
    jobTitle && `Target job title: ${jobTitle}`,
    `Target company: ${companyName}`,
    jobDescription && `Job description:\n${jobDescription}`,
    customPrompt && `Additional instructions:\n${customPrompt}`,
    headerTitle && `Current resume title line: ${headerTitle}`,
    `Template companies (${existingExperiences.length} required — copy company, role, dates exactly into each JSON experience object):\n${existingExperiences
      .map(
        (e, i) =>
          `${i + 1}. company="${e.company}" | role="${e.role}" | dates="${e.dates}" | bullets: rewrite all ${e.bullets.length} bullets`
      )
      .join("\n")}`,
    `Return exactly ${existingExperiences.length} objects in experiences[]. Rewrite title, summary, skills, and bullets only. Return valid json only.`,
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
