import type { GeneratedResumeContent } from "@/lib/resume-types";
import {
  extractResumeTitleHeadline,
  sanitizeResumeFileBaseName,
} from "@/lib/resume-filename";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function slugifyRole(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function replaceHeadlineInText(text: string, oldHeadline: string, newHeadline: string): string {
  if (!text || !oldHeadline) return text;
  return text.replace(new RegExp(escapeRegex(oldHeadline), "gi"), newHeadline);
}

function syncExperienceRole(role: string, oldHeadline: string, newHeadline: string): string {
  const plain = role.replace(/\*\*/g, "").trim();
  if (!plain) return newHeadline;
  if (oldHeadline && new RegExp(escapeRegex(oldHeadline), "i").test(plain)) {
    return replaceHeadlineInText(role, oldHeadline, newHeadline);
  }
  // Role no longer matches prior title headline — align it to the new resume title role.
  return newHeadline;
}

/** Replace the role slug / underscored headline inside a resume file base name. */
export function replaceRoleInResumeFileBaseName(
  baseName: string,
  oldHeadline: string,
  newHeadline: string
): string {
  if (!baseName.trim() || !oldHeadline.trim() || !newHeadline.trim()) return baseName;

  let result = baseName;
  const oldPlain = oldHeadline.trim();
  const newPlain = newHeadline.trim();

  // Spaced headline (e.g. "Senior Solutions Engineer")
  if (oldPlain && newPlain && oldPlain.toLowerCase() !== newPlain.toLowerCase()) {
    result = result.replace(new RegExp(escapeRegex(oldPlain), "gi"), newPlain);
  }

  const oldUnderscore = oldPlain.replace(/\s+/g, "_");
  const newUnderscore = newPlain.replace(/\s+/g, "_");
  if (oldUnderscore && newUnderscore && oldUnderscore.toLowerCase() !== newUnderscore.toLowerCase()) {
    result = result.replace(new RegExp(escapeRegex(oldUnderscore), "gi"), newUnderscore);
  }

  const oldSlug = slugifyRole(oldHeadline);
  const newSlug = slugifyRole(newHeadline);
  if (oldSlug && newSlug && oldSlug !== newSlug) {
    result = result.replace(new RegExp(escapeRegex(oldSlug), "gi"), newSlug);
  }

  return sanitizeResumeFileBaseName(result);
}

/**
 * When the resume title's main role (text before the first `|`) changes, keep
 * summary, experience roles, and fileName role segment aligned with it.
 */
export function applyResumeTitleHeadlineChange(
  content: GeneratedResumeContent,
  nextTitle: string,
  previousHeadline: string
): GeneratedResumeContent {
  const newHeadline = extractResumeTitleHeadline(nextTitle);
  const oldHeadline = previousHeadline.trim();

  if (!newHeadline) {
    return { ...content, title: nextTitle };
  }

  if (!oldHeadline || oldHeadline.toLowerCase() === newHeadline.toLowerCase()) {
    return { ...content, title: nextTitle };
  }

  const summary = replaceHeadlineInText(content.summary, oldHeadline, newHeadline);
  const experiences = content.experiences.map((exp) => ({
    ...exp,
    role: syncExperienceRole(exp.role, oldHeadline, newHeadline),
  }));

  const nextFileName = content.fileName?.trim()
    ? replaceRoleInResumeFileBaseName(content.fileName, oldHeadline, newHeadline)
    : content.fileName;

  return {
    ...content,
    title: nextTitle,
    summary,
    experiences,
    ...(nextFileName?.trim() ? { fileName: nextFileName } : {}),
  };
}
