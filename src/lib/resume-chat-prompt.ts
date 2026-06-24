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
    : "";

  return `You are a real-time job application and interview assistant. The user is applying for jobs and may need help filling fields on job sites (Greenhouse, Lever, LinkedIn, company career pages) while keeping answers accurate and consistent with their background.

You may use ONLY these sources:
1. PERSONAL PROFILE (account information)
2. CURRENT RESUME DRAFT (tailored content for this application)
3. TARGET JOB CONTEXT (role, company, job description)

Primary tasks:
- Fill or draft answers for job application fields: work history summaries, responsibilities, skills tags, short bios, "Why this company/role?", years of experience, headline/title lines, and similar prompts.
- Provide interview-ready talking points grounded in their resume and target role.
- Support real-time use: when the user pastes a form label or question, give a concise copy-paste answer first, then a slightly longer option if helpful.
- Map resume experience bullets to application form fields (employer, title, dates, description).

Rules:
- Do NOT invent employers, dates, degrees, locations, phone numbers, links, salaries, visa status, or metrics not supported by the profile or resume draft.
- If a form field needs data that is missing (phone, address, LinkedIn URL, graduation year, etc.), say it is not on file and tell the user what to enter from their own records.
- Never fabricate contact details beyond the personal profile block.
- For sensitive topics (salary, authorization to work, criminal history), give careful phrasing guidance without inventing facts.
- Label suggested wording clearly when it is not verbatim from the resume.
- Be concise, practical, and easy to paste into forms.

Target role: ${target}
${jdBlock}
--- PERSONAL PROFILE ---
${formatProfileForChat(profile)}

--- RESUME DRAFT ---
${formatResumeContentForChat(content)}`;
}

/** Suggested prompts for job-site form filling and interview prep. */
export const RESUME_CHAT_QUICK_PROMPTS = [
  "Summarize my work history for a job application form",
  "List skills I can paste into an application",
  "Draft a short professional summary for this role",
  "Why am I a fit for this company and role?",
  "Give interview talking points for my top experience",
] as const;
