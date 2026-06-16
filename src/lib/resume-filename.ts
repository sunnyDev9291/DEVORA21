import type { GeneratedResumeContent } from "@/lib/resume-types";

function slugifyJobTitle(jobTitle: string): string {
  return jobTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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
  content: Pick<GeneratedResumeContent, "title" | "skills">
): string {
  const name = templateName.trim().replace(/[^a-zA-Z0-9_-]/g, "") || "resume";
  const role = slugifyJobTitle(jobTitle) || "role";
  const skillPart = extractResumeTitleSkills(content.title, content.skills);

  return skillPart ? `${name}_${role}_${skillPart}` : `${name}_${role}`;
}

export function buildExpectedResumeFileName(
  templateName: string,
  jobTitle: string,
  content: Pick<GeneratedResumeContent, "title" | "skills">
): string {
  return `${buildExpectedResumeBaseName(templateName, jobTitle, content)}.docx`;
}
