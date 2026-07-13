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

export function stripBarLabelFromValue(value: string, field: keyof ResumeProject): string {
  if (field === "name") return value.trim();
  const patterns: Record<string, RegExp> = {
    businessChallenge:
      /^(?:(?:work\s+and\s+)?business\s+(?:need|challenge)|business\s+(?:need|challenge))\s*:?\s*/i,
    assignedResponsibility: /^(?:assigned\s+)?responsibilit(?:y|ies)\s*:?\s*/i,
    action: /^(?:actions?|work|word)\s*:?\s*/i,
    result: /^results?\s*:?\s*/i,
  };
  return value.replace(patterns[field] ?? /^$/, "").trim();
}

export function normalizeResumeProject(raw: Partial<ResumeProject> | undefined): ResumeProject {
  const base = {
    name: String(raw?.name ?? "").trim(),
    businessChallenge: String(raw?.businessChallenge ?? "").trim(),
    assignedResponsibility: String(raw?.assignedResponsibility ?? "").trim(),
    action: String(raw?.action ?? "").trim(),
    result: String(raw?.result ?? "").trim(),
  };
  return {
    name: base.name,
    businessChallenge: stripBarLabelFromValue(base.businessChallenge, "businessChallenge"),
    assignedResponsibility: stripBarLabelFromValue(base.assignedResponsibility, "assignedResponsibility"),
    action: stripBarLabelFromValue(base.action, "action"),
    result: stripBarLabelFromValue(base.result, "result"),
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
