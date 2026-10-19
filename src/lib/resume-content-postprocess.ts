import { isProjectLayout } from "@/lib/resume-experience-utils";
import {
  flattenResumeSkillTerms,
  normalizeResumeSkills,
  type ResumeSkillsMap,
} from "@/lib/resume-skills";
import { formatSkillsWithTemplateStyle, parseTemplateSkillLines } from "@/lib/resume-skills-style";
import type { GeneratedResumeContent, ResumeProject, ResumeTemplateLayout } from "@/lib/resume-types";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isInsideBold(text: string, index: number): boolean {
  const before = text.slice(0, index);
  return ((before.match(/\*\*/g) ?? []).length % 2) === 1;
}

/** Letters/digits count as part of a word — prevents "git" matching inside "Digital". */
function isTokenChar(ch: string | undefined): boolean {
  return Boolean(ch && /[A-Za-z0-9]/.test(ch));
}

/** True when `term` is a whole token at [start, end), not a substring of a larger word. */
function isStandaloneTermMatch(text: string, start: number, end: number): boolean {
  if (isInsideBold(text, start)) return false;
  if (isTokenChar(text[start - 1])) return false;
  if (isTokenChar(text[end])) return false;
  return true;
}

/** Real 1–2 letter tech that must stay as collectable terms (API parity). */
const SHORT_TECH_TERMS = new Set(["c", "r", "go"]);

function shouldKeepSkillTerm(token: string): boolean {
  if (!token) return false;
  if (token.length >= 2) return true;
  return SHORT_TECH_TERMS.has(token.toLowerCase());
}

/**
 * Collect tech terms from the skills block for auto-bold in title/summary/experience.
 */
export function collectSkillTermsFromSkillsBlock(
  skills: ResumeSkillsMap | string
): string[] {
  const map = normalizeResumeSkills(skills);
  return flattenResumeSkillTerms(map).filter(shouldKeepSkillTerm);
}

/** @deprecated Prefer collectSkillTermsFromSkillsBlock (same behavior). */
export function extractSkillTerms(skills: ResumeSkillsMap | string): string[] {
  return collectSkillTermsFromSkillsBlock(skills);
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
      if (!isStandaloneTermMatch(result, start, end)) continue;
      replacements.push({ start, end, value: `**${match[0]}**` });
    }

    for (const rep of replacements.reverse()) {
      result = result.slice(0, rep.start) + rep.value + result.slice(rep.end);
    }
  }

  return result.replace(/\*\*\*\*([^*]+)\*\*\*\*/g, "**$1**");
}

/**
 * Strip accidental bold from skill item values — category keys stay as-is.
 */
export function boldSkillCategoryLabels(skills: ResumeSkillsMap | string): ResumeSkillsMap {
  const map = normalizeResumeSkills(skills);
  const out: ResumeSkillsMap = {};
  for (const [category, items] of Object.entries(map)) {
    out[category.replace(/\*\*/g, "").trim()] = (items ?? []).map((item) =>
      item.replace(/\*\*/g, "").trim()
    );
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

/**
 * Style formatting only: bold skill terms in title/summary/experience.
 * Skills stay as a category→items object.
 */
export function applyResumeContentPostProcess(
  content: GeneratedResumeContent,
  layout: ResumeTemplateLayout = content.layout ?? "bullets",
  skillsSample?: string
): GeneratedResumeContent {
  const skillTerms = collectSkillTermsFromSkillsBlock(content.skills);
  const projectMode = isProjectLayout(layout);
  const alignedSkills = skillsSample?.trim()
    ? formatSkillsWithTemplateStyle(content.skills, skillsSample, layout)
    : normalizeResumeSkills(content.skills);
  const templateHasCategoryLabels = skillsSample?.trim()
    ? parseTemplateSkillLines(skillsSample).some((line) => Boolean(line.label))
    : Object.keys(alignedSkills).length > 0;
  const skillsWithTemplateStyle =
    projectMode || templateHasCategoryLabels
      ? boldSkillCategoryLabels(alignedSkills)
      : alignedSkills;

  return {
    ...content,
    layout: projectMode ? "projects" : "bullets",
    title: boldSkillTermsInText(content.title, skillTerms),
    summary: boldSkillTermsInText(content.summary, skillTerms),
    skills: skillsWithTemplateStyle,
    experiences: content.experiences.map((exp) => {
      if (projectMode || exp.projects?.length) {
        return {
          company: exp.company,
          role: boldSkillTermsInText(exp.role, skillTerms),
          dates: exp.dates,
          ...(exp.location?.trim() ? { location: exp.location.trim() } : {}),
          bullets: [],
          projects: (exp.projects ?? []).map((project) => boldProjectFields(project, skillTerms)),
        };
      }

      return {
        company: exp.company,
        role: boldSkillTermsInText(exp.role, skillTerms),
        dates: exp.dates,
        ...(exp.location?.trim() ? { location: exp.location.trim() } : {}),
        bullets: (exp.bullets ?? [])
          .map((b) => b.trim())
          .filter(Boolean)
          .map((bullet) => boldSkillTermsInText(bullet, skillTerms)),
      };
    }),
  };
}
