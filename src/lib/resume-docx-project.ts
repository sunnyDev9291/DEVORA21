import type { GeneratedResumeContent, ResumeExperience, ResumeProject } from "@/lib/resume-types";
import { normalizeResumeProject } from "@/lib/resume-experience-utils";
import {
  getDocxParagraphs,
  getParagraphText,
  getParagraphTextWithBold,
  matchTextRuns,
  setBarFieldParagraphText,
  type DocxParagraph,
} from "@/lib/resume-docx";
import { boldSkillTermsInText, extractSkillTerms } from "@/lib/resume-content-postprocess";

const SECTION_HEADERS = {
  experience:
    /^(EXPERIENCE|Experience|WORK EXPERIENCE|Work Experience|PROFESSIONAL EXPERIENCE|Professional Experience|EMPLOYMENT|Employment)$/i,
  education: /^(EDUCATION|Education)$/i,
};

const DATE_PATTERN =
  /(\d{1,2}\/\d{4}\s*[-–—]\s*(?:\d{1,2}\/\d{4}|Present|Current)|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\s*[-–—]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|Present|Current|\d{4})|\d{4}\s*[-–—]\s*(?:\d{4}|Present|Current))/i;

export type ProjectFieldKey =
  | "businessChallenge"
  | "assignedResponsibility"
  | "action"
  | "result";

const PROJECT_FIELD_PATTERNS: Array<{ field: ProjectFieldKey; pattern: RegExp }> = [
  {
    field: "businessChallenge",
    pattern:
      /^(?:(?:work\s+and\s+)?business\s+(?:need|challenge)|business\s+(?:need|challenge))\s*:?\s*(.*)$/i,
  },
  {
    field: "assignedResponsibility",
    pattern: /^(?:assigned\s+)?responsibilit(?:y|ies)\s*:?\s*(.*)$/i,
  },
  { field: "action", pattern: /^(?:actions?|work|word)\s*:?\s*(.*)$/i },
  { field: "result", pattern: /^results?\s*:?\s*(.*)$/i },
];

const PROJECT_NAME_PATTERN = /^projects?\s*:?\s*(.*)$/i;

const FIELD_LABEL_ONLY = new Set([
  "business challenge",
  "business need",
  "work and business need",
  "challenge",
  "assigned responsibility",
  "assigned responsibilities",
  "responsibility",
  "responsibilities",
  "action",
  "actions",
  "work",
  "word",
  "result",
  "results",
]);

function fieldKeyFromLabelOnly(label: string): ProjectFieldKey {
  const lower = label.toLowerCase();
  if (lower.includes("need") || lower.includes("challenge")) return "businessChallenge";
  if (lower.includes("responsibilit")) return "assignedResponsibility";
  if (lower === "work" || lower === "word" || lower.startsWith("action")) return "action";
  return "result";
}

function isSectionHeader(text: string): boolean {
  return SECTION_HEADERS.education.test(text) || SECTION_HEADERS.experience.test(text);
}

function parseDatesFromLine(text: string): string | null {
  const match = text.match(DATE_PATTERN);
  return match ? match[0].replace(/\s+/g, " ").trim() : null;
}

function parseCombinedExperienceLine(text: string): Pick<ResumeExperience, "company" | "role" | "dates"> | null {
  const dates = parseDatesFromLine(text);
  if (!dates) return null;
  const beforeDates = text.replace(DATE_PATTERN, "").replace(/,+\s*$/, "").trim();
  const parts = beforeDates.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { company: parts[parts.length - 1], role: parts.slice(0, -1).join(", "), dates };
  }
  return { company: beforeDates, role: "", dates };
}

function parseRoleDatesLine(text: string): { role: string; dates: string } | null {
  const dates = parseDatesFromLine(text);
  if (!dates) return null;
  const role = text.replace(DATE_PATTERN, "").replace(/,+\s*$/, "").trim();
  if (!role) return null;
  return { role, dates };
}

function looksLikeBulletSentence(text: string): boolean {
  if (text.length < 90) return false;
  return /^[A-Z][a-z]+(?:ed|ing|ized|ised|built|led|developed|engineered|implemented|migrated|optimized|delivered|designed|created|improved|reduced|increased)\b/i.test(
    text
  );
}

function tryParseJobHeader(
  line: DocxParagraph,
  next: DocxParagraph | null
): { header: Pick<ResumeExperience, "company" | "role" | "dates">; skipNext: boolean } | null {
  if (line.isListItem || !line.text) return null;

  const combined = parseCombinedExperienceLine(line.text);
  if (combined && !looksLikeBulletSentence(line.text)) {
    return { header: combined, skipNext: false };
  }

  if (
    next &&
    !next.isListItem &&
    !parseDatesFromLine(line.text) &&
    line.text.length <= 80 &&
    !looksLikeBulletSentence(line.text)
  ) {
    const roleDates = parseRoleDatesLine(next.text);
    if (roleDates && !parseCombinedExperienceLine(next.text)) {
      return {
        header: { company: line.text, role: roleDates.role, dates: roleDates.dates },
        skipNext: true,
      };
    }
  }

  return null;
}

function classifyParagraph(text: string): {
  kind: "project_name" | "field" | "other";
  field?: ProjectFieldKey;
  inlineValue?: string;
} {
  const trimmed = text.trim();
  const projectMatch = PROJECT_NAME_PATTERN.exec(trimmed);
  if (projectMatch) {
    return { kind: "project_name", inlineValue: projectMatch[1]?.trim() ?? "" };
  }

  for (const { field, pattern } of PROJECT_FIELD_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match) {
      return { kind: "field", field, inlineValue: match[1]?.trim() ?? "" };
    }
  }

  if (FIELD_LABEL_ONLY.has(trimmed.toLowerCase())) {
    return { kind: "field", field: fieldKeyFromLabelOnly(trimmed), inlineValue: "" };
  }

  return { kind: "other" };
}

function isLikelyProjectTitle(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 140) return false;
  if (parseDatesFromLine(trimmed)) return false;
  if (PROJECT_FIELD_PATTERNS.some(({ pattern }) => pattern.test(trimmed))) return false;
  if (FIELD_LABEL_ONLY.has(trimmed.toLowerCase())) return false;
  if (looksLikeBulletSentence(trimmed)) return false;
  return true;
}

export function detectProjectTemplateLayout(buffer: Buffer): boolean {
  const paragraphs = getDocxParagraphs(buffer);
  const expIdx = paragraphs.findIndex((p) => SECTION_HEADERS.experience.test(p.text));
  const eduIdx = paragraphs.findIndex((p) => SECTION_HEADERS.education.test(p.text));
  if (expIdx === -1) return false;

  const end = eduIdx === -1 ? paragraphs.length : eduIdx;
  let fieldHits = 0;
  let projectHits = 0;

  for (let i = expIdx + 1; i < end; i += 1) {
    const text = paragraphs[i].text.trim();
    if (!text || isSectionHeader(text)) continue;
    const classified = classifyParagraph(text);
    if (classified.kind === "project_name") projectHits += 1;
    if (classified.kind === "field") fieldHits += 1;
  }

  return fieldHits >= 3 || (projectHits >= 1 && fieldHits >= 2);
}

function parseProjectBlock(lines: DocxParagraph[]): {
  projects: ResumeProject[];
  projectParagraphGroups: string[][][];
} {
  const projects: ResumeProject[] = [];
  const projectParagraphGroups: string[][][] = [];
  let currentProject: ResumeProject = normalizeResumeProject({});
  let currentGroup: string[][] = [];
  let currentField: ProjectFieldKey | null = null;
  let pendingField: ProjectFieldKey | null = null;

  const flushProject = () => {
    if (
      currentProject.name ||
      currentProject.businessChallenge ||
      currentProject.assignedResponsibility ||
      currentProject.action ||
      currentProject.result
    ) {
      projects.push({ ...currentProject });
      projectParagraphGroups.push(currentGroup);
    }
    currentProject = normalizeResumeProject({});
    currentGroup = [];
    currentField = null;
    pendingField = null;
  };

  for (const line of lines) {
    if (!line.text.trim()) continue;

    const classified = classifyParagraph(line.text);

    if (classified.kind === "project_name") {
      flushProject();
      currentProject.name =
        classified.inlineValue || line.text.replace(/^projects?\s*:?\s*/i, "").trim();
      currentGroup.push([line.xml]);
      continue;
    }

    if (classified.kind === "field" && classified.field) {
      currentField = classified.field;
      if (classified.inlineValue) {
        currentProject[classified.field] = classified.inlineValue;
        currentGroup.push([line.xml]);
        pendingField = null;
        currentField = null;
      } else {
        pendingField = classified.field;
        currentGroup.push([line.xml]);
      }
      continue;
    }

    if (pendingField) {
      currentProject[pendingField] = line.text.trim();
      const last = currentGroup[currentGroup.length - 1];
      if (last) last.push(line.xml);
      pendingField = null;
      currentField = null;
      continue;
    }

    // Project titles are plain lines (no "Project:" prefix) — detect before currentField absorbs them.
    if (classified.kind === "other" && isLikelyProjectTitle(line.text)) {
      flushProject();
      currentProject.name = line.text.trim();
      currentGroup.push([line.xml]);
      continue;
    }

    if (currentField) {
      currentProject[currentField] = line.text.trim();
      const last = currentGroup[currentGroup.length - 1];
      if (last) last.push(line.xml);
      currentField = null;
      continue;
    }
  }

  flushProject();
  return { projects, projectParagraphGroups };
}

export type ProjectJobTemplate = {
  header: Pick<ResumeExperience, "company" | "role" | "dates">;
  headerParagraphXml: string[];
  projects: ResumeProject[];
  projectParagraphGroups: string[][][];
};

export function parseProjectExperiencesFromDocxBuffer(buffer: Buffer): {
  experiences: ResumeExperience[];
  jobTemplates: ProjectJobTemplate[];
} {
  const paragraphs = getDocxParagraphs(buffer);
  const expIdx = paragraphs.findIndex((p) => SECTION_HEADERS.experience.test(p.text));
  const eduIdx = paragraphs.findIndex((p) => SECTION_HEADERS.education.test(p.text));
  if (expIdx === -1) throw new Error("EXPERIENCE section not found in template.");

  const end = eduIdx === -1 ? paragraphs.length : eduIdx;
  const experiences: ResumeExperience[] = [];
  const jobTemplates: ProjectJobTemplate[] = [];

  let currentHeader: Pick<ResumeExperience, "company" | "role" | "dates"> | null = null;
  let headerParagraphXml: string[] = [];
  let jobLines: DocxParagraph[] = [];

  const flushJob = () => {
    if (!currentHeader) return;
    const parsed = parseProjectBlock(jobLines);
    experiences.push({
      ...currentHeader,
      bullets: [],
      projects: parsed.projects,
    });
    jobTemplates.push({
      header: { ...currentHeader },
      headerParagraphXml: [...headerParagraphXml],
      projects: parsed.projects,
      projectParagraphGroups: parsed.projectParagraphGroups,
    });
    currentHeader = null;
    headerParagraphXml = [];
    jobLines = [];
  };

  for (let i = expIdx + 1; i < end; i += 1) {
    const line = paragraphs[i];
    if (!line.text || isSectionHeader(line.text)) continue;

    const headerMatch = tryParseJobHeader(line, paragraphs[i + 1] ?? null);
    if (headerMatch) {
      flushJob();
      currentHeader = headerMatch.header;
      headerParagraphXml = [line.xml];
      if (headerMatch.skipNext) {
        headerParagraphXml.push(paragraphs[i + 1].xml);
        i += 1;
      }
      continue;
    }

    if (currentHeader) jobLines.push(line);
  }

  flushJob();
  return { experiences, jobTemplates };
}

export function validateParsedProjectExperiences(
  experiences: ResumeExperience[]
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (experiences.length === 0) errors.push("no experience entries found");

  experiences.forEach((exp, index) => {
    const label = `Job ${index + 1}`;
    if (!exp.company.trim()) errors.push(`${label}: missing company`);
    if (!exp.role.trim()) errors.push(`${label}: missing role`);
    if (!exp.dates.trim()) errors.push(`${label}: missing dates`);
    if (!exp.projects?.length) errors.push(`${label}: no projects found`);
    exp.projects?.forEach((project, projectIndex) => {
      const pLabel = `${label} project ${projectIndex + 1}`;
      if (!project.name.trim()) errors.push(`${pLabel}: missing project name`);
      if (!project.businessChallenge.trim() && !project.action.trim()) {
        errors.push(`${pLabel}: missing challenge or action`);
      }
    });
  });

  return errors.length ? { ok: false, errors } : { ok: true };
}

export function extractProjectTemplateSamples(buffer: Buffer): {
  sampleProjects: ResumeProject[];
  sampleProjectXml: string[];
} {
  const { jobTemplates } = parseProjectExperiencesFromDocxBuffer(buffer);
  const sampleProjects: ResumeProject[] = [];
  const sampleProjectXml: string[] = [];

  for (const job of jobTemplates) {
    for (let i = 0; i < job.projects.length && sampleProjects.length < 2; i += 1) {
      sampleProjects.push(job.projects[i]);
      const group = job.projectParagraphGroups[i] ?? [];
      sampleProjectXml.push(
        group
          .flat()
          .map((xml) => getParagraphTextWithBold(xml))
          .filter(Boolean)
          .join("\n")
      );
    }
  }

  return { sampleProjects, sampleProjectXml };
}

function fieldLabelPrefix(text: string, field: ProjectFieldKey): string {
  const classified = classifyParagraph(text);
  if (classified.kind === "field" && !classified.inlineValue) return text.trim();
  if (classified.kind === "field" && classified.inlineValue) {
    return text.replace(classified.inlineValue, "").trim().replace(/\s*:?\s*$/, "") + ": ";
  }
  const labels: Record<ProjectFieldKey, string> = {
    businessChallenge: "Business Challenge",
    assignedResponsibility: "Assigned Responsibility",
    action: "Action",
    result: "Result",
  };
  return `${labels[field]}: `;
}

function paragraphXmlHasBoldRun(pXml: string): boolean {
  const runs = matchTextRuns(pXml);
  return runs.some(
    (run) => /<w:t[\s\S]*?<\/w:t>/.test(run) && /<w:b(?:\s[^>]*)?\/>|<w:b(?:\s[^>]*)?>/.test(run)
  );
}

function resolveBarFieldLabel(sampleText: string, field: ProjectFieldKey): string {
  let label = fieldLabelPrefix(sampleText, field).trim();
  if (label.endsWith(":")) label = label.slice(0, -1);
  if (!label) {
    const labels: Record<ProjectFieldKey, string> = {
      businessChallenge: "Business Challenge",
      assignedResponsibility: "Assigned Responsibility",
      action: "Action",
      result: "Result",
    };
    label = labels[field];
  }
  return label;
}

function applyProjectToParagraphGroup(
  paragraphGroups: string[][],
  project: ResumeProject,
  setParagraphText: (xml: string, text: string) => string,
  skillTerms: string[]
): string[] {
  const bold = (text: string) => boldSkillTermsInText(text, skillTerms);
  const out: string[] = [];

  for (const group of paragraphGroups) {
    if (group.length === 0) continue;
    const sampleText = getParagraphText(group[0]);
    const classified = classifyParagraph(sampleText);

    if (classified.kind === "project_name") {
      const hasPrefix = /^projects?\s*:/i.test(sampleText);
      const nameText = hasPrefix ? `Project: ${project.name}` : project.name;
      const rendered =
        paragraphXmlHasBoldRun(group[0]) && !hasPrefix
          ? bold(project.name)
          : hasPrefix
            ? `**Project:** ${bold(project.name)}`
            : bold(nameText);
      out.push(setParagraphText(group[0], rendered.trim()));
      for (let i = 1; i < group.length; i += 1) out.push(group[i]);
      continue;
    }

    if (classified.kind === "field" && classified.field) {
      const field = classified.field;
      const value = field === "action" ? project[field] : bold(project[field]);
      if (group.length === 1) {
        out.push(
          setBarFieldParagraphText(group[0], resolveBarFieldLabel(sampleText, field), value)
        );
      } else {
        // Label line keeps template XML (bold label styling preserved).
        out.push(group[0]);
        out.push(setParagraphText(group[1], value));
        for (let i = 2; i < group.length; i += 1) out.push(group[i]);
      }
      continue;
    }

    for (const xml of group) out.push(xml);
  }

  return out;
}

export function buildProjectExperienceParagraphs(
  content: GeneratedResumeContent,
  jobTemplates: ProjectJobTemplate[],
  setParagraphText: (xml: string, text: string) => string,
  skillTerms?: string[]
): string[] {
  const terms = skillTerms?.length ? skillTerms : extractSkillTerms(content.skills);
  const bold = (text: string) => boldSkillTermsInText(text, terms);
  const experienceParagraphs: string[] = [];

  for (let jobIndex = 0; jobIndex < content.experiences.length; jobIndex += 1) {
    const exp = content.experiences[jobIndex];
    const template = jobTemplates[jobIndex] ?? jobTemplates[jobTemplates.length - 1];
    if (!template) continue;

    for (const headerXml of template.headerParagraphXml) {
      const text = getParagraphText(headerXml);
      if (parseCombinedExperienceLine(text)) {
        const headerText = exp.dates
          ? `${bold(exp.role)}, ${exp.company}, ${exp.dates}`
          : `${bold(exp.role)}, ${exp.company}`;
        experienceParagraphs.push(setParagraphText(headerXml, headerText));
      } else if (parseRoleDatesLine(text)) {
        const roleDates = exp.dates ? `${bold(exp.role)}    ${exp.dates}` : bold(exp.role);
        experienceParagraphs.push(setParagraphText(headerXml, roleDates));
      } else {
        experienceParagraphs.push(setParagraphText(headerXml, exp.company));
      }
    }

    const projects = exp.projects ?? [];
    for (let projectIndex = 0; projectIndex < projects.length; projectIndex += 1) {
      const project = projects[projectIndex];
      const paragraphGroups =
        template.projectParagraphGroups[projectIndex] ??
        template.projectParagraphGroups[template.projectParagraphGroups.length - 1] ??
        [];
      experienceParagraphs.push(
        ...applyProjectToParagraphGroup(paragraphGroups, project, setParagraphText, terms)
      );
    }
  }

  return experienceParagraphs;
}
