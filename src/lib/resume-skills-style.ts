/** One skill category line from the uploaded template (labels + markdown bold pattern). */
export type TemplateSkillLine = {
  label: string;
  sampleLine: string;
};

export function parseTemplateSkillLines(templateSkills: string): TemplateSkillLine[] {
  return templateSkills
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((sampleLine) => {
      const markdown = sampleLine.match(/^\*\*([^*:]+):\*\*\s*(.*)$/);
      if (markdown) {
        return { label: markdown[1].trim(), sampleLine };
      }
      const plain = sampleLine.match(/^([^:]+):\s*(.*)$/);
      if (plain) {
        return { label: plain[1].replace(/\*\*/g, "").trim(), sampleLine };
      }
      return { label: "", sampleLine };
    });
}

function parseSkillsByCategory(skills: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of skills.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const markdown = trimmed.match(/^\*\*([^*:]+):\*\*\s*(.*)$/);
    const plain = trimmed.match(/^([^:]+):\s*(.*)$/);
    const label = (markdown?.[1] ?? plain?.[1] ?? "").replace(/\*\*/g, "").trim();
    const value = (markdown?.[2] ?? plain?.[2] ?? "").replace(/\*\*/g, "").trim();

    if (label) {
      map.set(label.toLowerCase(), value);
    } else if (!map.has("__flat__")) {
      map.set("__flat__", trimmed.replace(/\*\*/g, ""));
    }
  }
  return map;
}

function collectSkillTokens(skills: string): string[] {
  const tokens: string[] = [];
  const seen = new Set<string>();

  for (const line of skills.split(/\n+/)) {
    const trimmed = line.trim().replace(/\*\*/g, "");
    if (!trimmed) continue;

    const category = trimmed.match(/^([^:]+):\s*(.*)$/);
    const valuePart = category ? category[2] : trimmed;

    for (const raw of valuePart.split(/[,;]/)) {
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
  const key = label.toLowerCase();
  if (map.has(key)) return map.get(key)!;

  for (const [k, v] of map) {
    if (k === "__flat__") continue;
    if (k.includes(key) || key.includes(k)) return v;
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

/**
 * Reshape AI skillsets to match the template: same line count, category labels, and formatting.
 */
export function alignSkillsToTemplate(aiSkills: string, templateSkills: string): string {
  const templateLines = parseTemplateSkillLines(templateSkills);
  if (templateLines.length === 0) return aiSkills.trim();

  const aiMap = parseSkillsByCategory(aiSkills);
  const flat = aiMap.get("__flat__") ?? "";
  const categorizedTemplate = templateLines.filter((line) => line.label);

  if (categorizedTemplate.length > 0) {
    const allTokens = collectSkillTokens(aiSkills);
    let tokenIndex = 0;

    const lines = templateLines.map((templateLine) => {
      let value = templateLine.label ? findCategoryValue(aiMap, templateLine.label) : "";

      if (!value && flat && templateLines.length === 1) {
        value = flat;
      }

      if (!value && allTokens.length > 0 && categorizedTemplate.length > 0) {
        const share = Math.ceil(allTokens.length / categorizedTemplate.length);
        const slice = allTokens.slice(tokenIndex, tokenIndex + share);
        tokenIndex += share;
        value = slice.join(", ");
      }

      if (!templateLine.label) {
        return value || templateLine.sampleLine.replace(/\*\*/g, "");
      }

      return formatSkillLineLikeTemplate(templateLine.label, value, templateLine.sampleLine);
    });

    return lines.filter(Boolean).join("\n");
  }

  if (templateLines.length === 1) {
    const tokens = collectSkillTokens(aiSkills);
    const merged = tokens.length > 0 ? tokens.join(", ") : flat || aiSkills.replace(/\n+/g, ", ").trim();
    const sample = templateLines[0].sampleLine;
    if (/^\*\*/.test(sample)) {
      return merged;
    }
    return merged;
  }

  const tokens = collectSkillTokens(aiSkills);
  const perLine = Math.ceil(tokens.length / templateLines.length) || 0;
  return templateLines
    .map((templateLine, index) => {
      const slice = tokens.slice(index * perLine, (index + 1) * perLine);
      if (slice.length === 0) return templateLine.sampleLine.replace(/\*\*/g, "").trim();
      return slice.join(", ");
    })
    .join("\n");
}

export function buildTemplateSkillsPromptBlock(templateSkills: string): string {
  const lines = parseTemplateSkillLines(templateSkills);
  if (lines.length === 0 || !templateSkills.trim()) return "";

  const labels = lines.map((l) => l.label).filter(Boolean);
  const labelHint =
    labels.length > 0
      ? `Use exactly these category labels in this order: ${labels.join(", ")}.`
      : `Use exactly ${lines.length} line(s) like the template.`;

  return [
    "Template skillsets style (required — match exactly):",
    labelHint,
    `Return exactly ${lines.length} newline-separated skill line(s) in the "skills" JSON field.`,
    "Mirror the template formatting (category labels, colons, line breaks). Only swap in JD-relevant technologies.",
    "Template example:",
    templateSkills.trim(),
  ].join("\n");
}
