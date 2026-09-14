import type { GeneratedResumeContent } from "@/lib/resume-types";

export type ResumeChatProfileContext = {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

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

export function formatProfileForChat(profile?: ResumeChatProfileContext): string {
  if (!profile) return "Not provided.";

  const lines: string[] = [];
  if (profile.fullName?.trim()) lines.push(`Full name: ${profile.fullName.trim()}`);
  if (profile.firstName?.trim()) lines.push(`First name: ${profile.firstName.trim()}`);
  if (profile.lastName?.trim()) lines.push(`Last name: ${profile.lastName.trim()}`);
  if (profile.email?.trim()) lines.push(`Email: ${profile.email.trim()}`);

  return lines.length > 0 ? lines.join("\n") : "Not provided.";
}

export function isUsableResumeChatContent(
  content?: GeneratedResumeContent | null
): content is GeneratedResumeContent {
  return Boolean(
    content?.title?.trim() &&
      content.summary?.trim() &&
      content.skills?.trim() &&
      Array.isArray(content.experiences)
  );
}

/** Build chat context when one-shot from-job returns PDF but no structured draft. */
export function resolveResumeChatContent({
  content,
  jobTitle,
  companyName,
}: {
  content?: GeneratedResumeContent | null;
  jobTitle?: string;
  companyName?: string;
}): GeneratedResumeContent | null {
  if (isUsableResumeChatContent(content)) return content;

  const title = jobTitle?.trim() || companyName?.trim();
  if (!title) return null;

  return {
    title,
    summary:
      "Structured resume draft was not returned for this generation. Use only the personal profile and target job context. Do not invent work history, skills, employers, or dates.",
    skills: "Not provided in a structured draft.",
    experiences: [],
  };
}

export function buildResumeChatSystemPrompt({
  content,
  profile,
  jobTitle,
  companyName,
  jobDescription,
}: {
  content: GeneratedResumeContent;
  profile?: ResumeChatProfileContext;
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
    : "\nJOB DESCRIPTION (target role):\nNot provided — rely on the resume draft, profile, and target role/company names.\n";

  const draftNote =
    content.experiences.length === 0
      ? "\nNote: No structured experience bullets were provided. Prefer the personal profile and job description. If a fact is not on file, say so plainly.\n"
      : "";

  return `You help the user answer job application and interview questions using only their profile, resume draft, and target job context.

Answer style (required):
Write short answers that sound like a real person typed them. Use clear plain text only. Keep replies unstructured: no bullet lists, numbered lists, headings, markdown, bold, italics, emoji, or decorative symbols. Prefer one short paragraph, or a few plain sentences. Do not add labels like Option 1 or Suggested answer. Just give the answer ready to paste.

What to do:
Help with application form fields and interview questions. When the user pastes a question or field label, reply with one short paste-ready answer. Keep greetings brief.

Accuracy rules:
Use only the personal profile, resume draft, and target job context. Do not invent employers, dates, degrees, locations, phone numbers, links, salaries, visa status, or metrics. If something needed is missing, say so in one plain sentence. For sensitive topics (salary, work authorization, criminal history), give careful wording without inventing facts. If the job description is missing, still help from the resume and profile.
${draftNote}
Target role: ${target}
${jdBlock}
--- PERSONAL PROFILE ---
${formatProfileForChat(profile)}

--- RESUME DRAFT ---
${formatResumeContentForChat(content)}`;
}
