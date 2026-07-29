import { extractResumeJsonRaw } from "@/lib/resume-prompt";

export type ResumeAiDisplaySection = {
  key: string;
  value: string;
};

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

function formatExperienceValue(exp: Record<string, unknown>): string {
  const lines: string[] = [];
  const company = typeof exp.company === "string" ? exp.company : "";
  const role = typeof exp.role === "string" ? exp.role : "";
  const dates = typeof exp.dates === "string" ? exp.dates : "";

  if (company) lines.push(`company: ${company}`);
  if (role) lines.push(`role: ${role}`);
  if (dates) lines.push(`dates: ${dates}`);

  if (Array.isArray(exp.bullets) && exp.bullets.length > 0) {
    lines.push("bullets:");
    for (const bullet of exp.bullets) {
      if (typeof bullet === "string" && bullet.trim()) {
        lines.push(`- ${bullet}`);
      }
    }
  }

  if (Array.isArray(exp.projects) && exp.projects.length > 0) {
    lines.push("projects:");
    for (const project of exp.projects) {
      if (!project || typeof project !== "object") continue;
      const p = project as Record<string, unknown>;
      const name = typeof p.name === "string" ? p.name : "";
      if (name) lines.push(`- ${name}`);
      for (const field of [
        "businessChallenge",
        "assignedResponsibility",
        "action",
        "result",
      ] as const) {
        const val = p[field];
        if (typeof val === "string" && val.trim()) {
          lines.push(`  ${field}: ${val}`);
        }
      }
    }
  }

  return lines.join("\n");
}

function formatExperiences(value: unknown): string {
  if (!Array.isArray(value)) return String(value ?? "");
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((exp) => formatExperienceValue(exp))
    .filter(Boolean)
    .join("\n\n");
}

const SECTION_ORDER = ["title", "summary", "skills", "fileName", "layout", "experiences"] as const;

/** Build key/value display sections from streamed or complete resume JSON. */
export function parseResumeAiDisplaySections(raw: string): ResumeAiDisplaySection[] | null {
  const jsonText = extractResumeJsonRaw(raw);
  if (!jsonText.trim().startsWith("{")) return null;

  let parsed: Record<string, unknown> | null = null;
  for (const attempt of [jsonText, repairTruncatedJson(jsonText)]) {
    try {
      const value = JSON.parse(attempt) as unknown;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        parsed = value as Record<string, unknown>;
        break;
      }
    } catch {
      // try next
    }
  }

  if (!parsed) return null;

  const sections: ResumeAiDisplaySection[] = [];
  const seen = new Set<string>();

  for (const key of SECTION_ORDER) {
    if (!(key in parsed)) continue;
    seen.add(key);
    const value = parsed[key];
    if (value == null || value === "") continue;

    if (key === "experiences") {
      const formatted = formatExperiences(value);
      if (formatted) sections.push({ key, value: formatted });
      continue;
    }

    if (typeof value === "string") {
      sections.push({ key, value });
    } else {
      sections.push({ key, value: JSON.stringify(value, null, 2) });
    }
  }

  for (const [key, value] of Object.entries(parsed)) {
    if (seen.has(key) || value == null || value === "") continue;
    if (typeof value === "string") {
      sections.push({ key, value });
    } else if (Array.isArray(value)) {
      sections.push({ key, value: JSON.stringify(value, null, 2) });
    } else if (typeof value === "object") {
      sections.push({ key, value: JSON.stringify(value, null, 2) });
    }
  }

  return sections.length > 0 ? sections : null;
}
