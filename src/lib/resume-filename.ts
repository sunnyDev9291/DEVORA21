import type { GeneratedResumeContent } from "@/lib/resume-types";

function stripMarkdownBold(value: string): string {
  return value.replace(/\*\*/g, "").trim();
}

function slugifyJobTitle(jobTitle: string): string {
  return jobTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function sanitizeResumeFileBaseName(name: string): string {
  return name
    .replace(/\*\*/g, "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/_{2,}/g, "_")
    .replace(/,\s*,+/g, ",")
    .replace(/,\s*$/g, "")
    .replace(/^\s*,/g, "")
    .trim();
}

/** True when a template slug is a generic upload name, not a person's name. */
export function isGenericTemplateNamePrefix(name: string): boolean {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    !normalized ||
    normalized === "resume" ||
    normalized === "cv" ||
    normalized === "template" ||
    normalized === "original" ||
    normalized === "originaldocx" ||
    normalized.startsWith("untitled")
  );
}

/** Prefer profile full name; fall back to non-generic template basename. */
export function resolveResumeNamePrefix(profileName?: string, templateName?: string): string {
  const profile = profileName?.trim();
  if (profile) {
    return sanitizeResumeFileBaseName(profile);
  }

  const fromTemplate = sanitizeResumeFileBaseName(
    (templateName ?? "").trim().replace(/\.docx$/i, "")
  );
  if (fromTemplate && !isGenericTemplateNamePrefix(fromTemplate)) {
    return fromTemplate;
  }

  return "resume";
}

/** Lines like `Resume file name : Franco Torrez_Senior Software Engineer_{first main skill},…` */
export function extractResumeFileNamePatternFromPrompt(customPrompt: string): string | null {
  const match = customPrompt.match(
    /(?:^|\n)\s*resume\s+file\s*name\s*:\s*(.+?)(?:\s*$|\s*\n)/im
  );
  return match?.[1]?.trim() || null;
}

function parseSkillTokens(skills: string): string[] {
  return skills
    .split(/[,;]/)
    .map((s) => stripMarkdownBold(s))
    .map((s) => s.replace(/[\\/:*?"<>|]/g, "").trim())
    .filter(Boolean);
}

/** Up to three main skills — title pipe segments first, then skills field. */
export function extractMainSkillsFromContent(
  title: string,
  skills: string
): [string, string, string] {
  const pipeParts = title
    .split("|")
    .map((s) => stripMarkdownBold(s.trim()))
    .filter(Boolean);

  const collected: string[] = [];
  if (pipeParts.length > 1) {
    collected.push(...pipeParts.slice(1));
  }

  for (const skill of parseSkillTokens(skills)) {
    if (collected.length >= 3) break;
    if (!collected.some((s) => s.toLowerCase() === skill.toLowerCase())) {
      collected.push(skill);
    }
  }

  return [collected[0] ?? "", collected[1] ?? "", collected[2] ?? ""];
}

export function resolveResumeFileNameFromPrompt(
  pattern: string,
  context: {
    jobTitle: string;
    content: Pick<GeneratedResumeContent, "title" | "skills">;
  }
): string {
  const [firstSkill, secondSkill, thirdSkill] = extractMainSkillsFromContent(
    context.content.title,
    context.content.skills
  );
  const titleHeadline =
    stripMarkdownBold(context.content.title.split("|")[0]?.trim() ?? "") ||
    context.jobTitle.trim();

  const replacements: Array<[RegExp, string]> = [
    [/\{\s*first\s+main\s+skill\s*\}/gi, firstSkill],
    [/\{\s*second\s+main\s+skill\s*\}/gi, secondSkill],
    [/\{\s*third\s+main\s+skill\s*\}/gi, thirdSkill],
    [/\{\s*first\s+skill\s*\}/gi, firstSkill],
    [/\{\s*second\s+skill\s*\}/gi, secondSkill],
    [/\{\s*third\s+skill\s*\}/gi, thirdSkill],
    [/\{\s*job\s+title\s*\}/gi, context.jobTitle.trim() || titleHeadline],
    [/\{\s*resume\s+title\s*\}/gi, titleHeadline],
  ];

  let resolved = pattern;
  for (const [regex, value] of replacements) {
    resolved = resolved.replace(regex, value);
  }

  return sanitizeResumeFileBaseName(resolved);
}

/** Skills from resume title pipes, or fall back to the skillsets field. */
export function extractResumeTitleSkills(
  title: string,
  skills: string
): string {
  const pipeParts = title
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  const parts =
    pipeParts.length > 1
      ? pipeParts.slice(1)
      : skills
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean);

  return parts
    .map((s) => s.replace(/[\\/:*?"<>|]/g, "").trim())
    .filter(Boolean)
    .join(",");
}

export function buildExpectedResumeBaseName(
  templateName: string,
  jobTitle: string,
  content: Pick<GeneratedResumeContent, "title" | "skills">,
  customPrompt?: string,
  profileName?: string
): string {
  const pattern = customPrompt?.trim()
    ? extractResumeFileNamePatternFromPrompt(customPrompt)
    : null;

  if (pattern) {
    const fromPrompt = resolveResumeFileNameFromPrompt(pattern, { jobTitle, content });
    if (fromPrompt) return fromPrompt;
  }

  const name = resolveResumeNamePrefix(profileName, templateName);
  const role = slugifyJobTitle(jobTitle) || "role";
  const skillPart = extractResumeTitleSkills(content.title, content.skills);

  return skillPart ? `${name}_${role}_${skillPart}` : `${name}_${role}`;
}

export function buildExpectedResumeFileName(
  templateName: string,
  jobTitle: string,
  content: Pick<GeneratedResumeContent, "title" | "skills">,
  customPrompt?: string,
  resumeFileBaseName?: string,
  profileName?: string
): string {
  const base = resumeFileBaseName?.trim()
    ? sanitizeResumeFileBaseName(resumeFileBaseName)
    : buildExpectedResumeBaseName(templateName, jobTitle, content, customPrompt, profileName);
  return base ? `${base}.docx` : "resume.docx";
}
