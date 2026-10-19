import { normalizeResumeSkills, type ResumeSkillsMap } from "@/lib/resume-skills";
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

/** Format one category line using the template line's bold/colon pattern (legacy string path). */
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
 * Keep AI category keys/order/items. Template sample is ignored for content —
 * Mode-1 skills are already a map.
 */
export function formatSkillsWithTemplateStyle(
  aiSkills: ResumeSkillsMap | string,
  _templateSkills: string,
  _layout: ResumeTemplateLayout = "bullets"
): ResumeSkillsMap {
  return normalizeResumeSkills(aiSkills);
}

/** @deprecated Use formatSkillsWithTemplateStyle. */
export function alignSkillsToTemplate(
  aiSkills: ResumeSkillsMap | string,
  templateSkills: string
): ResumeSkillsMap {
  return formatSkillsWithTemplateStyle(aiSkills, templateSkills);
}

/**
 * Visual format hint only. Skills must be returned as a JSON object.
 * Counts, category names, and items come solely from Writing instructions.
 */
export function buildTemplateSkillsPromptBlock(
  templateSkills: string,
  _layout: ResumeTemplateLayout = "bullets"
): string {
  if (!templateSkills.trim()) {
    return [
      "skills MUST be a JSON object: { \"Category\": [\"item\", ...], ... }.",
      "Do NOT return skills as a newline string of \"Category: item, item\" lines.",
      "Category key count must match the template Skill Category count.",
      "Item-count rules apply to the total number of items across all arrays.",
    ].join("\n");
  }

  return [
    "skills MUST be a JSON object: { \"Category\": [\"item\", ...], ... }.",
    "Do NOT return skills as a newline string of \"Category: item, item\" lines.",
    "Category key count must match the template Skill Category count from Writing instructions / template structure.",
    "Item-count rules (e.g. 50–54) apply to the TOTAL number of items across all skills arrays.",
    "Template skillsets sample below is FORMAT/category-count hint only — not a content source:",
    templateSkills.trim(),
  ].join("\n");
}
