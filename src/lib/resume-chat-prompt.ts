import type { GeneratedResumeContent } from "@/lib/resume-types";

export function formatResumeContentForChat(content: GeneratedResumeContent): string {
  const lines: string[] = [
    `TITLE: ${content.title.trim()}`,
    "",
    `SUMMARY: ${content.summary.trim()}`,
    "",
    `SKILLS: ${content.skills.trim()}`,
    "",
    "EXPERIENCE:",
  ];

  for (const exp of content.experiences) {
    lines.push("");
    lines.push(`${exp.role.trim()} @ ${exp.company.trim()} (${exp.dates.trim()})`);
    for (const bullet of exp.bullets) {
      const trimmed = bullet.trim();
      if (trimmed) lines.push(`- ${trimmed}`);
    }
  }

  return lines.join("\n");
}

export function buildResumeChatSystemPrompt({
  content,
  jobTitle,
  companyName,
  jobDescription,
}: {
  content: GeneratedResumeContent;
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
}): string {
  const target =
    jobTitle?.trim() && companyName?.trim()
      ? `${jobTitle.trim()} at ${companyName.trim()}`
      : jobTitle?.trim() || "Not specified";

  const jdBlock = jobDescription?.trim()
    ? `\nJOB DESCRIPTION (target role):\n${jobDescription.trim()}\n`
    : "";

  return `You are a resume coach helping the user understand and improve their current resume draft.

Rules:
- Answer ONLY from the resume draft and job context below. Do not invent employers, dates, metrics, or projects.
- If the resume does not contain information needed to answer, say what is missing.
- Be concise, practical, and interview-focused when relevant.
- You may suggest edits or talking points, but label suggestions clearly and never present them as facts already on the resume.

Target role: ${target}
${jdBlock}
--- RESUME DRAFT ---
${formatResumeContentForChat(content)}`;
}
