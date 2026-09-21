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

function pickFormattingSample(templateLines: TemplateSkillLine[]): string {
  return (
    templateLines.find((line) => line.label)?.sampleLine ??
    templateLines[0]?.sampleLine ??
    "**Label:** values"
  );
}

function formatBulletSkills(aiSkills: string, templateSkills: string): string {
  const templateLineCount = Math.max(parseTemplateSkillLines(templateSkills).length, 1);
  const tokens = collectSkillTokens(aiSkills);
  const flat = tokens.length
    ? tokens.join(", ")
    : aiSkills.replace(/\*\*/g, "").replace(/\n+/g, ", ").trim();
  if (templateLineCount <= 1) return flat;

  const parts = flat.split(/\s*,\s*/).filter(Boolean);
  const perLine = Math.ceil(parts.length / templateLineCount);
  return Array.from({ length: templateLineCount }, (_, index) =>
    parts.slice(index * perLine, (index + 1) * perLine).join(", ")
  )
    .filter(Boolean)
    .join("\n");
}

/**
 * Keep AI/JD category labels and order; only borrow bold/colon style + max line count
 * from the template. Prevents remapping "Databases: Snowflake" onto "Frontend: …".
 */
function formatCategorySkillsFromAi(aiSkills: string, templateSkills: string): string | null {
  const templateLines = parseTemplateSkillLines(templateSkills);
  const maxLines = Math.max(templateLines.filter((l) => l.label).length, templateLines.length, 1);
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
    .slice(0, maxLines)
    .map(({ label, value }) => formatSkillLineLikeTemplate(label, value, sampleLine))
    .join("\n");
}

/** Fallback: map AI values onto the template's fixed category slots. */
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
 * Category templates: keep AI/JD labels + order (writing instructions win);
 * only reuse template bold/colon style and max line count.
 * Plain bullet templates use a flat skill list.
 */
export function formatSkillsWithTemplateStyle(
  aiSkills: string,
  templateSkills: string,
  layout: ResumeTemplateLayout = "bullets"
): string {
  const trimmed = aiSkills.trim();
  if (!trimmed) return trimmed;
  if (!templateSkills.trim()) return trimmed;

  const templateLines = parseTemplateSkillLines(templateSkills);
  const hasCategoryLabels = templateLines.some((line) => Boolean(line.label));

  if (layout === "projects" || hasCategoryLabels) {
    const fromAi = formatCategorySkillsFromAi(trimmed, templateSkills);
    if (fromAi) return fromAi;
    return formatProjectSkills(trimmed, templateSkills);
  }

  return formatBulletSkills(trimmed, templateSkills);
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

  const hasCategoryLabels = lines.some((line) => Boolean(line.label));
  const maxLines = lines.length;

  if (layout === "projects" || hasCategoryLabels) {
    return [
      "Template skillsets FORMAT (visual layout only — not fixed category names):",
      `Return at most ${maxLines} newline-separated category skill line(s) in the "skills" JSON field.`,
      "Each line must look like: **Category:** tech, tech, tech (bold label, colon, then skills).",
      "Keep a TAB-style gap after each category colon when the template uses one.",
      "Category NAMES and ORDER come from the Writing instructions / JD (e.g. Databases, Cloud, AI/ML for a data role).",
      "Do NOT force the template sample labels (Frontend/Backend/Tooling/…) unless the Writing instructions say so.",
      "If Writing instructions cap categories (e.g. keep 6), follow that cap and put JD-priority categories first.",
      "Place each technology under the most suitable category; do not dump unrelated tech into Frontend/Backend.",
      "Template formatting example (labels here are samples only):",
      templateSkills.trim(),
    ].join("\n");
  }

  return [
    "Template skillsets format (required — follow exactly):",
    "This bullet-style template uses a plain skill list with no category labels.",
    `Return ${maxLines === 1 ? "one plain comma-separated skill line" : `exactly ${maxLines} plain skill line(s)`} in the "skills" JSON field.`,
    "Do not add category labels like Languages, Backend, Frontend, Data & ML, or DevOps.",
    "Template example:",
    templateSkills.trim(),
  ].join("\n");
}
