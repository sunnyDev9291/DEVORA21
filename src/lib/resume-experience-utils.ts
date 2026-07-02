import type { GeneratedResumeContent, ResumeExperience, ResumeProject, ResumeTemplateLayout } from "@/lib/resume-types";

export function isProjectLayout(layout?: ResumeTemplateLayout): boolean {
  return layout === "projects";
}

export function experienceUsesProjects(exp: ResumeExperience, layout?: ResumeTemplateLayout): boolean {
  return isProjectLayout(layout) || (exp.projects?.length ?? 0) > 0;
}

export function flattenExperienceText(exp: ResumeExperience): string[] {
  if (exp.projects?.length) {
    return exp.projects.flatMap((project) => [
      project.name,
      project.businessChallenge,
      project.assignedResponsibility,
      project.action,
      project.result,
    ]);
  }
  return exp.bullets;
}

export function flattenContentExperienceText(content: GeneratedResumeContent): string[] {
  return content.experiences.flatMap((exp) => flattenExperienceText(exp));
}

export function emptyResumeProject(): ResumeProject {
  return {
    name: "",
    businessChallenge: "",
    assignedResponsibility: "",
    action: "",
    result: "",
  };
}

export function normalizeResumeProject(raw: Partial<ResumeProject> | undefined): ResumeProject {
  return {
    name: String(raw?.name ?? "").trim(),
    businessChallenge: String(raw?.businessChallenge ?? "").trim(),
    assignedResponsibility: String(raw?.assignedResponsibility ?? "").trim(),
    action: String(raw?.action ?? "").trim(),
    result: String(raw?.result ?? "").trim(),
  };
}

export function normalizeResumeExperience(
  raw: Partial<ResumeExperience>,
  layout?: ResumeTemplateLayout
): ResumeExperience {
  const projects = Array.isArray(raw.projects)
    ? raw.projects.map((project) => normalizeResumeProject(project))
    : undefined;

  return {
    company: String(raw.company ?? "").trim(),
    role: String(raw.role ?? "").trim(),
    dates: String(raw.dates ?? "").trim(),
    bullets: (raw.bullets ?? []).map((bullet) => String(bullet).trim()).filter(Boolean),
    ...(isProjectLayout(layout) || projects?.length ? { projects: projects ?? [] } : {}),
  };
}
