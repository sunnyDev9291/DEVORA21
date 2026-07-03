import { isProjectLayout } from "@/lib/resume-experience-utils";
import { formatSkillsWithTemplateStyle } from "@/lib/resume-skills-style";

import type { GeneratedResumeContent, ResumeProject, ResumeTemplateLayout } from "@/lib/resume-types";



function escapeRegex(value: string): string {

  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

}



function isInsideBold(text: string, index: number): boolean {

  const before = text.slice(0, index);

  return ((before.match(/\*\*/g) ?? []).length % 2) === 1;

}



/** Parse concrete tech terms from skills (comma list or grouped "Category: a, b" lines). */

export function extractSkillTerms(skills: string): string[] {

  const plain = skills.replace(/\*\*/g, "");

  const terms = new Set<string>();



  for (const line of plain.split(/\n+/)) {

    const segment = line.includes(":") ? line.split(":").slice(1).join(":") : line;

    for (const part of segment.split(/[,;|/]|\s+·\s+|\s+and\s+/i)) {

      const token = part.trim().replace(/^[-•]+\s*/, "");

      if (token.length >= 2) terms.add(token);

    }

  }



  return Array.from(terms).sort((a, b) => b.length - a.length);

}



/** Wrap skill terms in **markers** when they appear in plain text (for Word bold rendering). */

export function boldSkillTermsInText(text: string, terms: string[]): string {

  let result = text;

  for (const term of terms) {

    if (!term) continue;

    const regex = new RegExp(escapeRegex(term), "gi");

    const replacements: Array<{ start: number; end: number; value: string }> = [];



    let match: RegExpExecArray | null;

    while ((match = regex.exec(result)) !== null) {

      const start = match.index;

      const end = start + match[0].length;

      if (isInsideBold(result, start)) continue;

      replacements.push({ start, end, value: `**${match[0]}**` });

    }



    for (const rep of replacements.reverse()) {

      result = result.slice(0, rep.start) + rep.value + result.slice(rep.end);

    }

  }



  return result.replace(/\*\*\*\*([^*]+)\*\*\*\*/g, "**$1**");
}

/** Bold grouped skill category labels (e.g. **Languages:** Java, Python). */
export function boldSkillCategoryLabels(skills: string): string {
  return skills
    .split(/\n+/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.includes(":")) return trimmed;
      const colonIdx = trimmed.indexOf(":");
      const label = trimmed.slice(0, colonIdx).replace(/\*\*/g, "").trim();
      const value = trimmed.slice(colonIdx + 1).trim();
      if (!label) return trimmed;
      return value ? `**${label}:** ${value}` : `**${label}:**`;
    })
    .filter(Boolean)
    .join("\n");
}



function normalizeBulletsToCount(bullets: string[], targetCount: number, fallback: string[]): string[] {

  if (targetCount <= 0) return [];

  const trimmed = bullets.map((b) => b.trim()).filter(Boolean);

  if (trimmed.length === targetCount) return trimmed;

  if (trimmed.length > targetCount) return trimmed.slice(0, targetCount);

  const out = [...trimmed];

  while (out.length < targetCount) {

    out.push(fallback[out.length] ?? fallback[fallback.length - 1] ?? "");

  }

  return out;

}



function normalizeProjectsToCount(

  projects: ResumeProject[],

  targetCount: number,

  fallback: ResumeProject[]

): ResumeProject[] {

  if (targetCount <= 0) return [];

  if (projects.length === targetCount) return projects;

  if (projects.length > targetCount) return projects.slice(0, targetCount);

  const out = [...projects];

  while (out.length < targetCount) {

    out.push(fallback[out.length] ?? fallback[fallback.length - 1] ?? {

      name: "",

      businessChallenge: "",

      assignedResponsibility: "",

      action: "",

      result: "",

    });

  }

  return out;

}



function boldProjectFields(project: ResumeProject, skillTerms: string[]): ResumeProject {

  return {

    name: boldSkillTermsInText(project.name, skillTerms),

    businessChallenge: boldSkillTermsInText(project.businessChallenge, skillTerms),

    assignedResponsibility: boldSkillTermsInText(project.assignedResponsibility, skillTerms),

    action: project.action,

    result: boldSkillTermsInText(project.result, skillTerms),

  };

}



/** Enforce template counts and bold skillset terms inside experience content. */

export function applyResumeContentPostProcess(

  content: GeneratedResumeContent,

  templateExperiences: GeneratedResumeContent["experiences"],

  layout: ResumeTemplateLayout = content.layout ?? "bullets",

  templateSkillsSample?: string

): GeneratedResumeContent {

  const skillTerms = extractSkillTerms(content.skills);
  const projectMode = isProjectLayout(layout);
  const alignedSkills = templateSkillsSample?.trim()
    ? formatSkillsWithTemplateStyle(content.skills, templateSkillsSample, layout)
    : content.skills;
  const skillsWithTemplateStyle = projectMode ? boldSkillCategoryLabels(alignedSkills) : alignedSkills;

  return {
    ...content,
    layout: projectMode ? "projects" : "bullets",
    skills: skillsWithTemplateStyle,

    experiences: content.experiences.map((exp, index) => {

      const template = templateExperiences[index];



      if (projectMode || template?.projects?.length) {

        const targetCount = template?.projects?.length ?? exp.projects?.length ?? 0;

        const projects = normalizeProjectsToCount(

          exp.projects ?? [],

          targetCount,

          template?.projects ?? []

        ).map((project, projectIndex) =>

          boldProjectFields(

            {

              name: template?.projects?.[projectIndex]?.name ?? project.name,

              businessChallenge: project.businessChallenge,

              assignedResponsibility: project.assignedResponsibility,

              action: project.action,

              result: project.result,

            },

            skillTerms

          )

        );



        return {
          company: template?.company ?? exp.company,
          role: boldSkillTermsInText(exp.role, skillTerms),
          dates: template?.dates ?? exp.dates,
          bullets: [],
          projects,
        };
      }

      const targetCount = template?.bullets.length ?? exp.bullets.length;
      const bullets = normalizeBulletsToCount(exp.bullets, targetCount, template?.bullets ?? []);

      return {
        company: template?.company ?? exp.company,
        role: boldSkillTermsInText(exp.role, skillTerms),
        dates: template?.dates ?? exp.dates,
        bullets: bullets.map((bullet) => boldSkillTermsInText(bullet, skillTerms)),
      };

    }),

  };

}


