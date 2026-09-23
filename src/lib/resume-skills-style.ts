import type { ResumeTemplateLayout } from "@/lib/resume-types";

/** One skill category line from the uploaded template (labels + markdown bold pattern). */
export type TemplateSkillLine = {
  label: string;
  sampleLine: string;
};

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

function normalizeSkillLabel(label: string): string {
  return decodeXmlEntities(label.replace(/\*\*/g, "")).trim();
}

export function parseTemplateSkillLines(templateSkills: string): TemplateSkillLine[] {
  return templateSkills
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((sampleLine) => {
      const markdown = sampleLine.match(/^\*\*([^*:]+):\*\*\s*(.*)$/);
      if (markdown) {
        return { label: normalizeSkillLabel(markdown[1]), sampleLine };
      }
      const plain = sampleLine.match(/^([^:]+):\s*(.*)$/);
      if (plain) {
        return { label: normalizeSkillLabel(plain[1]), sampleLine };
      }
      return { label: "", sampleLine };
    });
}

function parseSkillLine(line: string): { label: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const markdown = trimmed.match(/^\*\*([^*:]+):\*\*\s*(.*)$/);
  if (markdown) {
    const label = normalizeSkillLabel(markdown[1]);
    const value = markdown[2].replace(/\*\*/g, "").trim();
    return label ? { label, value } : null;
  }

  // Colon outside bold: **Frontend**: values
  const boldLabel = trimmed.match(/^\*\*([^*]+)\*\*\s*:\s*(.*)$/);
  if (boldLabel) {
    const label = normalizeSkillLabel(boldLabel[1]);
    const value = boldLabel[2].replace(/\*\*/g, "").trim();
    return label ? { label, value } : null;
  }

  const plain = trimmed.match(/^([^:]+):\s*(.*)$/);
  if (plain) {
    const label = normalizeSkillLabel(plain[1]);
    const value = plain[2].replace(/\*\*/g, "").trim();
    return label ? { label, value } : null;
  }

  return null;
}

/** Format one category line using the template line's bold/colon pattern. */
export function formatSkillLineLikeTemplate(
  label: string,
  value: string,
  sampleLine: string
): string {
  if (!label) return value;

  const trimmedValue = value.trim();
  if (/^\*\*[^*:]+:\*\*/.test(sampleLine)) {
    return trimmedValue ? `**${label}:** ${trimmedValue}` : `**${label}:**`;
  }
  if (/^\*\*[^*]+\*\*:/.test(sampleLine)) {
    return trimmedValue ? `**${label}**: ${trimmedValue}` : `**${label}**:`;
  }
  return trimmedValue ? `${label}: ${trimmedValue}` : `${label}:`;
}

function pickFormattingSample(templateLines: TemplateSkillLine[]): string {
  return (
    templateLines.find((line) => line.label)?.sampleLine ??
    templateLines[0]?.sampleLine ??
    "**Label:** values"
  );
}

/**
 * Keep AI/Writing-instructions category labels, order, and line count.
 * Template only supplies bold/colon formatting — never caps or remaps categories.
 */
function formatCategorySkillsFromAi(aiSkills: string, templateSkills: string): string | null {
  const templateLines = parseTemplateSkillLines(templateSkills);
  const sampleLine = pickFormattingSample(templateLines);

  const aiCategoryLines: Array<{ label: string; value: string }> = [];
  for (const line of aiSkills.split(/\n+/)) {
    const parsed = parseSkillLine(line.trim());
    if (!parsed?.label) continue;
    if (!parsed.value.trim()) continue;
    aiCategoryLines.push(parsed);
  }

  if (aiCategoryLines.length === 0) return null;

  return aiCategoryLines
    .map(({ label, value }) => formatSkillLineLikeTemplate(label, value, sampleLine))
    .join("\n");
}

/**
 * Apply template bold/colon style only. Never cap category count, item count,
 * or remap onto template sample labels — Writing instructions are absolute.
 */
export function formatSkillsWithTemplateStyle(
  aiSkills: string,
  templateSkills: string,
  _layout: ResumeTemplateLayout = "bullets"
): string {
  const trimmed = aiSkills.trim();
  if (!trimmed) return trimmed;
  if (!templateSkills.trim()) return trimmed;

  const fromAi = formatCategorySkillsFromAi(trimmed, templateSkills);
  if (fromAi) return fromAi;

  // Flat / non-category skills from the model — keep exactly as returned.
  return trimmed;
}

/** @deprecated Use formatSkillsWithTemplateStyle. */
export function alignSkillsToTemplate(aiSkills: string, templateSkills: string): string {
  return formatSkillsWithTemplateStyle(aiSkills, templateSkills);
}

/**
 * Visual format hint only. Counts, category names, and items come solely from
 * Writing instructions (profile prompt) — not from the template sample.
 */
export function buildTemplateSkillsPromptBlock(
  templateSkills: string,
  _layout: ResumeTemplateLayout = "bullets"
): string {
  if (!templateSkills.trim()) return "";

  return [
    "Template skillsets FORMAT (visual only — NOT a content or count limit):",
    "Each category line should look like: **Category:** tech, tech, tech (bold label, colon, then skills).",
    "Keep a TAB-style gap after each category colon when the template uses one.",
    "ABSOLUTE RULE: Writing instructions alone decide category count, category names/order, and how many items per category.",
    "Do NOT use the template sample labels, line count, or item lists as limits or defaults.",
    "Do NOT force Frontend/Backend/Tooling/Monitoring (or any template sample) unless Writing instructions say so.",
    "Template formatting example (samples only — ignore these labels/counts for content):",
    templateSkills.trim(),
  ].join("\n");
}
