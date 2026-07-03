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

function normalizeCategoryKey(label: string): string {
  return normalizeSkillLabel(label)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function parseSkillsByCategory(skills: string): Map<string, string> {
  const map = new Map<string, string>();

  for (const line of skills.split(/\n+/)) {
    const parsed = parseSkillLine(line);
    if (!parsed) continue;
    map.set(normalizeCategoryKey(parsed.label), parsed.value);
  }

  return map;
}

function collectSkillTokens(skills: string): string[] {
  const tokens: string[] = [];
  const seen = new Set<string>();

  for (const line of skills.split(/\n+/)) {
    const parsed = parseSkillLine(line);
    const value = (parsed?.value ?? line).replace(/\*\*/g, "").trim();
    if (!value) continue;

    for (const raw of value.split(/[,;]/)) {
      const skill = raw.trim();
      if (!skill) continue;
      const key = skill.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        tokens.push(skill);
      }
    }
  }

  return tokens;
}

function findCategoryValue(map: Map<string, string>, label: string): string {
  const key = normalizeCategoryKey(label);
  if (map.has(key)) return map.get(key)!;

  for (const [candidate, value] of map) {
    if (candidate.includes(key) || key.includes(candidate)) return value;
  }

  return "";
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

function formatBulletSkills(aiSkills: string, templateSkills: string): string {
  const templateLineCount = Math.max(parseTemplateSkillLines(templateSkills).length, 1);
  const tokens = collectSkillTokens(aiSkills);
  const flat = tokens.length ? tokens.join(", ") : aiSkills.replace(/\*\*/g, "").replace(/\n+/g, ", ").trim();
  if (templateLineCount <= 1) return flat;

  const parts = flat.split(/\s*,\s*/).filter(Boolean);
  const perLine = Math.ceil(parts.length / templateLineCount);
  return Array.from({ length: templateLineCount }, (_, index) =>
    parts.slice(index * perLine, (index + 1) * perLine).join(", ")
  )
    .filter(Boolean)
    .join("\n");
}

function formatProjectSkills(aiSkills: string, templateSkills: string): string {
  const templateLines = parseTemplateSkillLines(templateSkills);
  if (templateLines.length === 0) return aiSkills.trim();

  const aiMap = parseSkillsByCategory(aiSkills);
  const allTokens = collectSkillTokens(aiSkills);
  const usedTokens = new Set<string>();
  const emptyLineIndexes: number[] = [];

  const lines = templateLines.map((templateLine, index) => {
    if (!templateLine.label) {
      emptyLineIndexes.push(index);
      return "";
    }

    const value = findCategoryValue(aiMap, templateLine.label);
    for (const token of collectSkillTokens(value)) usedTokens.add(token.toLowerCase());
    if (!value.trim()) emptyLineIndexes.push(index);

    return formatSkillLineLikeTemplate(templateLine.label, value, templateLine.sampleLine);
  });

  const remaining = allTokens.filter((token) => !usedTokens.has(token.toLowerCase()));
  if (remaining.length > 0 && emptyLineIndexes.length > 0) {
    const perLine = Math.ceil(remaining.length / emptyLineIndexes.length);
    emptyLineIndexes.forEach((lineIndex, index) => {
      const templateLine = templateLines[lineIndex];
      const value = remaining.slice(index * perLine, (index + 1) * perLine).join(", ");
      lines[lineIndex] = templateLine.label
        ? formatSkillLineLikeTemplate(templateLine.label, value, templateLine.sampleLine)
        : value;
    });
  } else if (remaining.length > 0 && lines.length > 0) {
    const lastIndex = lines.length - 1;
    const lastTemplate = templateLines[lastIndex];
    const parsed = parseSkillLine(lines[lastIndex]);
    const value = [parsed?.value, remaining.join(", ")].filter(Boolean).join(", ");
    lines[lastIndex] = lastTemplate.label
      ? formatSkillLineLikeTemplate(lastTemplate.label, value, lastTemplate.sampleLine)
      : value;
  }

  return lines.filter(Boolean).join("\n");
}

/**
 * Shape skillsets to the detected resume layout.
 * Bullet templates use a plain skill list; project/BAR templates keep template categories/order.
 */
export function formatSkillsWithTemplateStyle(
  aiSkills: string,
  templateSkills: string,
  layout: ResumeTemplateLayout = "bullets"
): string {
  const trimmed = aiSkills.trim();
  if (!trimmed) return trimmed;
  if (!templateSkills.trim()) return trimmed;

  return layout === "projects"
    ? formatProjectSkills(trimmed, templateSkills)
    : formatBulletSkills(trimmed, templateSkills);
}

/** @deprecated Use formatSkillsWithTemplateStyle. */
export function alignSkillsToTemplate(aiSkills: string, templateSkills: string): string {
  return formatSkillsWithTemplateStyle(aiSkills, templateSkills);
}

export function buildTemplateSkillsPromptBlock(
  templateSkills: string,
  layout: ResumeTemplateLayout = "bullets"
): string {
  const lines = parseTemplateSkillLines(templateSkills);
  if (lines.length === 0 || !templateSkills.trim()) return "";

  if (layout === "projects") {
    const labels = lines.map((line) => line.label).filter(Boolean);
    return [
      "Template skillsets format (required — follow exactly):",
      `Use exactly these category labels in this order: ${labels.join(", ")}.`,
      `Return exactly ${lines.length} newline-separated skill line(s) in the "skills" JSON field.`,
      "Mirror the template formatting (category labels, colons, line breaks). Only replace the technologies with JD-relevant ones.",
      "Template example:",
      templateSkills.trim(),
    ].join("\n");
  }

  return [
    "Template skillsets format (required — follow exactly):",
    "This bullet-style template uses a plain skill list with no category labels.",
    `Return ${lines.length === 1 ? "one plain comma-separated skill line" : `exactly ${lines.length} plain skill line(s)`} in the "skills" JSON field.`,
    "Do not add category labels like Languages, Backend, Frontend, Data & ML, or DevOps.",
    "Template example:",
    templateSkills.trim(),
  ].join("\n");
}

