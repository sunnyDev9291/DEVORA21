import type { GeneratedResumeContent } from "@/lib/resume-types";
import {
  extractResumeTitleHeadline,
  sanitizeResumeFileBaseName,
} from "@/lib/resume-filename";

/** Leading seniority / level tokens — kept when syncing a title change into roles/summary. */
const SENIORITY_TOKEN =
  /^(junior|jr|associate|mid-level|midlevel|mid|senior|sr|staff|principal|lead|head|distinguished|fellow)$/i;

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

/** Split "Senior Staff Software Engineer" → prefix "Senior Staff", core "Software Engineer". */
export function splitSeniorityFromHeadline(headline: string): { prefix: string; core: string } {
  const parts = headline.trim().split(/\s+/).filter(Boolean);
  const levels: string[] = [];
  let i = 0;
  while (i < parts.length && SENIORITY_TOKEN.test(parts[i])) {
    levels.push(parts[i]);
    i += 1;
  }
  return {
    prefix: levels.join(" "),
    core: parts.slice(i).join(" ").trim(),
  };
}

function replaceHeadlineInText(text: string, oldHeadline: string, newHeadline: string): string {
  if (!text || !oldHeadline) return text;
  return text.replace(new RegExp(escapeRegex(oldHeadline), "gi"), newHeadline);
}

/**
 * Sync experience role to a new resume title core — preserve each role's own level
 * (Senior / Staff / …). Never overwrite the whole role with the new title headline.
 */
function syncExperienceRole(role: string, oldCore: string, newCore: string): string {
  const plain = role.replace(/\*\*/g, "").trim();
  if (!plain || !oldCore || !newCore) return role;
  if (oldCore.toLowerCase() === newCore.toLowerCase()) return role;
  if (!new RegExp(escapeRegex(oldCore), "i").test(plain)) return role;
  return replaceHeadlineInText(role, oldCore, newCore);
}

/** Replace the role slug / underscored headline inside a resume file base name. */
export function replaceRoleInResumeFileBaseName(
  baseName: string,
  oldHeadline: string,
  newHeadline: string
): string {
  if (!baseName.trim() || !oldHeadline.trim() || !newHeadline.trim()) return baseName;

  const { core: oldCoreRaw } = splitSeniorityFromHeadline(oldHeadline);
  const { core: newCoreRaw } = splitSeniorityFromHeadline(newHeadline);
  const oldPlain = (oldCoreRaw || oldHeadline).trim();
  const newPlain = (newCoreRaw || newHeadline).trim();

  let result = baseName;

  // Spaced core title (e.g. "Software Engineer" — not "Senior Software Engineer")
  if (oldPlain && newPlain && oldPlain.toLowerCase() !== newPlain.toLowerCase()) {
    result = result.replace(new RegExp(escapeRegex(oldPlain), "gi"), newPlain);
  }

  const oldUnderscore = oldPlain.replace(/\s+/g, "_");
  const newUnderscore = newPlain.replace(/\s+/g, "_");
  if (oldUnderscore && newUnderscore && oldUnderscore.toLowerCase() !== newUnderscore.toLowerCase()) {
    result = result.replace(new RegExp(escapeRegex(oldUnderscore), "gi"), newUnderscore);
  }

  const oldSlug = slugifyRole(oldPlain);
  const newSlug = slugifyRole(newPlain);
  if (oldSlug && newSlug && oldSlug !== newSlug) {
    result = result.replace(new RegExp(escapeRegex(oldSlug), "gi"), newSlug);
  }

  return sanitizeResumeFileBaseName(result);
}

/**
 * When the resume title's main role (text before the first `|`) changes, sync the
 * job-title core into summary / experience roles / fileName — without changing
 * seniority levels (Senior, Staff, Principal, …) already on those fields.
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

  const { core: oldCore } = splitSeniorityFromHeadline(oldHeadline);
  const { core: newCore } = splitSeniorityFromHeadline(newHeadline);

  // Only seniority changed (e.g. Senior → Staff) — keep roles/summary levels as-is.
  if (!oldCore || !newCore || oldCore.toLowerCase() === newCore.toLowerCase()) {
    return { ...content, title: nextTitle };
  }

  const summary = replaceHeadlineInText(content.summary, oldCore, newCore);
  const experiences = content.experiences.map((exp) => ({
    ...exp,
    role: syncExperienceRole(exp.role, oldCore, newCore),
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
