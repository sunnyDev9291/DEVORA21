import { isProjectLayout } from "@/lib/resume-experience-utils";
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
 * Split items ONLY on commas/semicolons — never on "/" or "|" (keeps "A/B Testing").
 * Drops 1-letter junk; allows short tech C, R, Go.
 */
export function collectSkillTermsFromSkillsBlock(skills: string): string[] {
  const plain = skills.replace(/\*\*/g, "");
  const terms = new Set<string>();

  for (const line of plain.split(/\n+/)) {
    const segment = line.includes(":") ? line.split(":").slice(1).join(":") : line;
    for (const part of segment.split(/[,;]/)) {
      const token = part.trim().replace(/^[-•]+\s*/, "");
      if (shouldKeepSkillTerm(token)) terms.add(token);
    }
  }

  return Array.from(terms).sort((a, b) => b.length - a.length);
}

/** @deprecated Prefer collectSkillTermsFromSkillsBlock (same behavior). */
export function extractSkillTerms(skills: string): string[] {
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
 * Bold category LABELS only. Skill VALUES stay plain (strip any AI ** in values).
 * e.g. **Languages:** Java, Python — not **Java**.
 */
export function boldSkillCategoryLabels(skills: string): string {
  return skills
    .split(/\n+/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.includes(":")) return trimmed.replace(/\*\*/g, "");
      const colonIdx = trimmed.indexOf(":");
      const label = trimmed.slice(0, colonIdx).replace(/\*\*/g, "").trim();
      const value = trimmed.slice(colonIdx + 1).replace(/\*\*/g, "").trim();
      if (!label) return trimmed.replace(/\*\*/g, "");
      return value ? `**${label}:** ${value}` : `**${label}:**`;
    })
    .filter(Boolean)
    .join("\n");
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
    out.push(
      fallback[out.length] ??
        fallback[fallback.length - 1] ?? {
          name: "",
          businessChallenge: "",
          assignedResponsibility: "",
          action: "",
          result: "",
        }
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
 * Bold skillset terms in title/summary/experience. Keep AI/Instructions bullet counts.
 * Style-only: company / role / dates / location come from content JSON (AI), not DOCX headers.
 */
export function applyResumeContentPostProcess(
  content: GeneratedResumeContent,
  templateExperiences: GeneratedResumeContent["experiences"],
  layout: ResumeTemplateLayout = content.layout ?? "bullets",
  templateSkillsSample?: string
): GeneratedResumeContent {
  const skillTerms = collectSkillTermsFromSkillsBlock(content.skills);
  const projectMode = isProjectLayout(layout);
  const alignedSkills = templateSkillsSample?.trim()
    ? formatSkillsWithTemplateStyle(content.skills, templateSkillsSample, layout)
    : content.skills;
  const templateHasCategoryLabels = templateSkillsSample?.trim()
    ? parseTemplateSkillLines(templateSkillsSample).some((line) => Boolean(line.label))
    : false;
  const skillsWithTemplateStyle =
    projectMode || templateHasCategoryLabels
      ? boldSkillCategoryLabels(alignedSkills)
      : alignedSkills.replace(/\*\*/g, "");

  return {
    ...content,
    layout: projectMode ? "projects" : "bullets",
    title: boldSkillTermsInText(content.title, skillTerms),
    summary: boldSkillTermsInText(content.summary, skillTerms),
    skills: skillsWithTemplateStyle,
    experiences: content.experiences.map((exp, index) => {
      // Slot hints only (legacy parse or prior draft) — never freeze employers from DOCX.
      const hint = templateExperiences[index];

      if (projectMode || exp.projects?.length || hint?.projects?.length) {
        const targetCount = exp.projects?.length || hint?.projects?.length || 0;
        const projects = normalizeProjectsToCount(
          exp.projects ?? [],
          targetCount,
          hint?.projects ?? []
        ).map((project) =>
          boldProjectFields(
            {
              name: project.name,
              businessChallenge: project.businessChallenge,
              assignedResponsibility: project.assignedResponsibility,
              action: project.action,
              result: project.result,
            },
            skillTerms
          )
        );

        const company = exp.company?.trim() || hint?.company || "";
        const dates = exp.dates?.trim() || hint?.dates || "";
        const location = (exp.location?.trim() || hint?.location || "").trim();

        return {
          company,
          role: boldSkillTermsInText(exp.role || hint?.role || "", skillTerms),
          dates,
          ...(location ? { location } : {}),
          bullets: [],
          projects,
        };
      }

      const bullets = (exp.bullets ?? []).map((b) => b.trim()).filter(Boolean);
      const kept =
        bullets.length > 0
          ? bullets
          : (hint?.bullets ?? []).map((b) => b.trim()).filter(Boolean);
      const company = exp.company?.trim() || hint?.company || "";
      const dates = exp.dates?.trim() || hint?.dates || "";
      const location = (exp.location?.trim() || hint?.location || "").trim();

      return {
        company,
        role: boldSkillTermsInText(exp.role || hint?.role || "", skillTerms),
        dates,
        ...(location ? { location } : {}),
        bullets: kept.map((bullet) => boldSkillTermsInText(bullet, skillTerms)),
      };
    }),
  };
}
