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

/**
 * Apply template formatting (bold labels, colon style) to AI skill lines.
 * Category labels stay JD-driven — the template is style-only, not a fixed category list.
 */
export function formatSkillsWithTemplateStyle(aiSkills: string, templateSkills: string): string {
  const templateLines = parseTemplateSkillLines(templateSkills);
  const trimmed = aiSkills.trim();
  if (!trimmed) return trimmed;
  if (templateLines.length === 0) return trimmed;

  const styleSample =
    templateLines.find((line) => line.label)?.sampleLine ?? templateLines[0].sampleLine;

  return trimmed
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parsed = parseSkillLine(line);
      if (parsed) {
        return formatSkillLineLikeTemplate(parsed.label, parsed.value, styleSample);
      }
      return line;
    })
    .join("\n");
}

/** @deprecated Use formatSkillsWithTemplateStyle — kept for imports during transition. */
export function alignSkillsToTemplate(aiSkills: string, templateSkills: string): string {
  return formatSkillsWithTemplateStyle(aiSkills, templateSkills);
}

export function buildTemplateSkillsPromptBlock(templateSkills: string): string {
  const lines = parseTemplateSkillLines(templateSkills);
  if (lines.length === 0 || !templateSkills.trim()) return "";

  const lineCountHint =
    lines.length > 1
      ? `Use roughly ${lines.length} newline-separated skill line(s) (similar density to the template).`
      : "Use one or more newline-separated skill lines.";

  return [
    "Template skillsets formatting (style reference — categories are NOT fixed):",
    lineCountHint,
    "Choose category groupings that fit THIS job description (e.g. Languages, Cloud, Frontend, Data/ML, DevOps).",
    "Do NOT copy template category names unless they are relevant to the JD.",
    'Mirror the template formatting: **Category:** comma-separated tech terms, one category per line.',
    "Template example (labels are illustrative only — swap for JD-relevant groups):",
    templateSkills.trim(),
  ].join("\n");
}
