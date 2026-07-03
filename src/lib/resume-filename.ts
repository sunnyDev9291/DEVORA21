import type { GeneratedResumeContent } from "@/lib/resume-types";

function stripMarkdownBold(value: string): string {
  return value.replace(/\*\*/g, "").trim();
}

/** Headline role from generated resume title (text before the first `|`). */
export function extractResumeTitleHeadline(title: string): string {
  return stripMarkdownBold(title.split("|")[0]?.trim() ?? "");
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
  const tokens: string[] = [];

  for (const line of skills.split(/\r?\n/)) {
    const trimmed = stripMarkdownBold(line.trim());
    if (!trimmed) continue;

    const category = trimmed.match(/^(?:\*\*)?([^*:]+)(?:\*\*)?:\s*(.*)$/);
    const valuePart = category ? category[2] : trimmed;

    for (const raw of valuePart.split(/[,;]/)) {
      const skill = stripMarkdownBold(raw)
        .replace(/[\\/:*?"<>|]/g, "")
        .trim();
      if (!skill) continue;
      if (!tokens.some((existing) => existing.toLowerCase() === skill.toLowerCase())) {
        tokens.push(skill);
      }
    }
  }

  return tokens;
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
    for (const part of pipeParts.slice(1)) {
      if (collected.length >= 3) break;
      if (!collected.some((s) => s.toLowerCase() === part.toLowerCase())) {
        collected.push(part);
      }
    }
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
    content: Pick<GeneratedResumeContent, "title" | "skills">;
  }
): string {
  const [firstSkill, secondSkill, thirdSkill] = extractMainSkillsFromContent(
    context.content.title,
    context.content.skills
  );
  const titleHeadline = extractResumeTitleHeadline(context.content.title);

  const replacements: Array<[RegExp, string]> = [
    [/\{\s*first\s+main\s+skill\s*\}/gi, firstSkill],
    [/\{\s*second\s+main\s+skill\s*\}/gi, secondSkill],
    [/\{\s*third\s+main\s+skill\s*\}/gi, thirdSkill],
    [/\{\s*first\s+skill\s*\}/gi, firstSkill],
    [/\{\s*second\s+skill\s*\}/gi, secondSkill],
    [/\{\s*third\s+skill\s*\}/gi, thirdSkill],
    [/\{\s*job\s+title\s*\}/gi, titleHeadline],
    [/\{\s*resume\s+title\s*\}/gi, titleHeadline],
    [/\{\s*role\s*\}/gi, slugifyJobTitle(titleHeadline) || titleHeadline.replace(/\s+/g, "_")],
  ];

  let resolved = pattern;
  for (const [regex, value] of replacements) {
    resolved = resolved.replace(regex, value);
  }

  return sanitizeResumeFileBaseName(resolved);
}

/** Up to three skills from resume title pipes, or from the skills field. */
export function extractResumeTitleSkills(
  title: string,
  skills: string,
  maxSkills = 3
): string {
  const pipeParts = title
    .split("|")
    .map((s) => stripMarkdownBold(s.trim()))
    .filter(Boolean);

  const parts =
    pipeParts.length > 1 ? pipeParts.slice(1) : parseSkillTokens(skills);

  return parts
    .slice(0, maxSkills)
    .map((s) => s.replace(/[\\/:*?"<>|]/g, "").trim())
    .filter(Boolean)
    .join(",");
}

export function buildExpectedResumeBaseName(
  templateName: string,
  content: Pick<GeneratedResumeContent, "title" | "skills">,
  customPrompt?: string,
  profileName?: string
): string {
  const pattern = customPrompt?.trim()
    ? extractResumeFileNamePatternFromPrompt(customPrompt)
    : null;

  if (pattern) {
    const fromPrompt = resolveResumeFileNameFromPrompt(pattern, { content });
    if (fromPrompt) return fromPrompt;
  }

  const name = resolveResumeNamePrefix(profileName, templateName);
  const role = slugifyJobTitle(extractResumeTitleHeadline(content.title)) || "role";
  const skillPart = extractResumeTitleSkills(content.title, content.skills);

  return skillPart ? `${name}_${role}_${skillPart}` : `${name}_${role}`;
}

/** Normalize AI or user-provided base name (strip .docx, unsafe chars). */
export function normalizeResumeFileBaseName(name: string): string {
  return sanitizeResumeFileBaseName(name.replace(/\.docx$/i, "").trim());
}

/** Prefer AI `fileName` on content; otherwise derive once from prompt/title/skills. */
export function ensureResumeContentFileName(
  content: GeneratedResumeContent,
  options: {
    templateName: string;
    customPrompt?: string;
    profileName?: string;
  }
): GeneratedResumeContent {
  const fromAi = content.fileName?.trim();
  if (fromAi) {
    return { ...content, fileName: normalizeResumeFileBaseName(fromAi) };
  }

  const built = buildExpectedResumeBaseName(
    options.templateName,
    content,
    options.customPrompt,
    options.profileName
  );
  return built ? { ...content, fileName: built } : content;
}

export function resumeFileBaseNameFromContent(
  content: Pick<GeneratedResumeContent, "title" | "skills" | "fileName">,
  fallback: () => string
): string {
  const fromAi = content.fileName?.trim();
  if (fromAi) return normalizeResumeFileBaseName(fromAi);
  return fallback();
}

export function buildExpectedResumeFileName(
  templateName: string,
  content: Pick<GeneratedResumeContent, "title" | "skills" | "fileName">,
  customPrompt?: string,
  resumeFileBaseName?: string,
  profileName?: string
): string {
  const base = resumeFileBaseName?.trim()
    ? normalizeResumeFileBaseName(resumeFileBaseName)
    : content.fileName?.trim()
      ? normalizeResumeFileBaseName(content.fileName)
      : buildExpectedResumeBaseName(templateName, content, customPrompt, profileName);
  return base ? `${base}.docx` : "resume.docx";
}
