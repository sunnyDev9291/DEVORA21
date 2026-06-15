import PizZip from "pizzip";
import type { GeneratedResumeContent } from "@/lib/resume-types";

const SECTION_HEADERS = {
  summary: /^(SUMMARY|Summary|PROFESSIONAL SUMMARY|Professional Summary)$/i,
  skills: /^(SKILLS|Skills|SKILLSETS|Skillsets|TECHNICAL SKILLS|Technical Skills)$/i,
  experience:
    /^(EXPERIENCE|Experience|WORK EXPERIENCE|Work Experience|PROFESSIONAL EXPERIENCE|Professional Experience|EMPLOYMENT|Employment)$/i,
  education: /^(EDUCATION|Education)$/i,
};

export type DocxParagraph = {
  text: string;
  isListItem: boolean;
  xml: string;
};

function isListParagraph(pXml: string): boolean {
  return /<w:numPr[\s\S]*?<\/w:numPr>/.test(pXml);
}

export function getDocxParagraphs(buffer: Buffer): DocxParagraph[] {
  const zip = new PizZip(buffer);
  const xml = zip.file("word/document.xml")?.asText();
  if (!xml) throw new Error("Invalid docx: missing document.xml");

  const paragraphs = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
  return paragraphs.map((pXml) => ({
    text: getParagraphText(pXml).trim(),
    isListItem: isListParagraph(pXml),
    xml: pXml,
  }));
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getParagraphText(pXml: string): string {
  return (pXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
    .map((t) => t.replace(/<w:t[^>]*>/, "").replace(/<\/w:t>/, ""))
    .join("");
}

function paragraphHasPageBreak(pXml: string): boolean {
  return /<w:lastRenderedPageBreak\b|<w:br\s[^>]*w:type="page"/.test(pXml);
}

function copyPageBreakFromTemplate(targetP: string, templateP: string): string {
  if (!paragraphHasPageBreak(templateP) || paragraphHasPageBreak(targetP)) {
    return targetP;
  }

  const runBreak = templateP.match(/<w:lastRenderedPageBreak[^/]*\/>/)?.[0];
  if (runBreak) {
    return targetP.replace(
      /(<w:r(?:\s[^>]*)?>(?:\s*<w:rPr[\s\S]*?<\/w:rPr>)?)/,
      `$1${runBreak}`
    );
  }

  if (/<w:pPr[\s\S]*?<\/w:pPr>/.test(targetP)) {
    return targetP.replace(/<w:pPr([^>]*)>/, '<w:pPr$1><w:lastRenderedPageBreak w:val="1"/>');
  }

  const open = targetP.match(/^(<w:p[^>]*>)/)?.[1] ?? "<w:p>";
  const rest = targetP.slice(open.length);
  return `${open}<w:pPr><w:lastRenderedPageBreak w:val="1"/></w:pPr>${rest}`;
}

function applyPageBreaksFromTemplate(
  targetParagraphs: string[],
  templateParagraphs: string[]
): void {
  for (let i = 0; i < templateParagraphs.length; i += 1) {
    if (i >= targetParagraphs.length) break;
    targetParagraphs[i] = copyPageBreakFromTemplate(targetParagraphs[i], templateParagraphs[i]);
  }
}

function setParagraphText(pXml: string, text: string): string {
  if (!/\*\*[^*]+\*\*/.test(text)) {
    const preserved = replaceSingleRunParagraphText(pXml, text);
    if (preserved) return preserved;
  }

  const open = pXml.match(/^(<w:p[^>]*>)/)?.[1] ?? "<w:p>";
  const pPr = pXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
  const runs = buildRunsFromMarkdownText(pXml, text);
  return `${open}${pPr}${runs}</w:p>`;
}

/** Keep full run/rPr XML when the paragraph has a single text run (typical bullets/headers). */
function replaceSingleRunParagraphText(pXml: string, text: string): string | null {
  const runs = pXml.match(/<w:r[\s\S]*?<\/w:r>/g) ?? [];
  const textRuns = runs.filter((run) => /<w:t[\s\S]*?<\/w:t>/.test(run));
  if (textRuns.length !== 1) return null;

  const updatedRun = textRuns[0].replace(
    /<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/,
    `<w:t xml:space="preserve">${escapeXml(text)}</w:t>`
  );
  return pXml.replace(textRuns[0], updatedRun);
}

type ExperienceStyleBlock = {
  headerTemplate: string;
  roleTemplate?: string;
  bulletTemplate: string;
};

function extractExperienceStyleBlocks(
  originalParas: string[],
  useCombinedHeaders: boolean
): ExperienceStyleBlock[] {
  const lines: DocxParagraph[] = originalParas.map((xml) => ({
    xml,
    text: getParagraphText(xml).trim(),
    isListItem: isListParagraph(xml),
  }));

  const blocks: ExperienceStyleBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.text || isSectionHeader(line.text)) {
      i += 1;
      continue;
    }

    const headerMatch = tryParseJobHeader(line, lines[i + 1] ?? null);
    if (!headerMatch) {
      i += 1;
      continue;
    }

    const block: ExperienceStyleBlock = {
      headerTemplate: line.xml,
      bulletTemplate: line.xml,
    };

    i += 1;

    if (!useCombinedHeaders) {
      if (headerMatch.skipNext && i < lines.length) {
        block.roleTemplate = lines[i].xml;
        i += 1;
      }
    } else if (headerMatch.skipNext) {
      i += 1;
    }

    if (i < lines.length && lines[i].isListItem) {
      block.bulletTemplate = lines[i].xml;
    }

    blocks.push(block);

    while (i < lines.length && lines[i].isListItem) {
      i += 1;
    }
  }

  return blocks;
}

function extractBaseRunProperties(pXml: string): string {
  const fromRun = pXml.match(/<w:r[^>]*>[\s\S]*?<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0];
  if (fromRun) {
    const rPr = fromRun.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0];
    if (rPr) return rPr;
  }
  const fromPara = pXml.match(/<w:pPr>[\s\S]*?<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0];
  if (fromPara) {
    const rPr = fromPara.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0];
    if (rPr) return rPr;
  }
  return "";
}

function buildRunsFromMarkdownText(pXml: string, text: string): string {
  const baseRPr = extractBaseRunProperties(pXml);
  const boldRPr =
    baseRPr && baseRPr.includes("<w:b")
      ? baseRPr
      : baseRPr
        ? baseRPr.replace("</w:rPr>", "<w:b/></w:rPr>")
        : "<w:rPr><w:b/></w:rPr>";

  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return `<w:r>${baseRPr}<w:t xml:space="preserve"></w:t></w:r>`;
  }

  return parts
    .map((part) => {
      const boldMatch = /^\*\*([^*]+)\*\*$/.exec(part);
      const content = boldMatch ? boldMatch[1] : part;
      const rPr = boldMatch ? boldRPr || "<w:rPr><w:b/></w:rPr>" : baseRPr;
      return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(content)}</w:t></w:r>`;
    })
    .join("");
}

function findSectionIndex(paragraphs: string[], pattern: RegExp): number {
  return paragraphs.findIndex((p) => pattern.test(getParagraphText(p).trim()));
}

const DATE_PATTERN =
  /(\d{1,2}\/\d{4}\s*[-–—]\s*(?:\d{1,2}\/\d{4}|Present|Current)|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\s*[-–—]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|Present|Current|\d{4})|\d{4}\s*[-–—]\s*(?:\d{4}|Present|Current))/i;

function parseDatesFromLine(text: string): string | null {
  const match = text.match(DATE_PATTERN);
  return match ? match[0].replace(/\s+/g, " ").trim() : null;
}

/** "Senior Engineer, Acme Corp, 08/2023 – 02/2025" on one line (Franco-style templates). */
function parseCombinedExperienceLine(text: string): Pick<
  GeneratedResumeContent["experiences"][number],
  "company" | "role" | "dates"
> | null {
  const dates = parseDatesFromLine(text);
  if (!dates) return null;

  const beforeDates = text.replace(DATE_PATTERN, "").replace(/,+\s*$/, "").trim();
  const parts = beforeDates.split(",").map((p) => p.trim()).filter(Boolean);

  if (parts.length >= 2) {
    return {
      company: parts[parts.length - 1],
      role: parts.slice(0, -1).join(", "),
      dates,
    };
  }

  return { company: beforeDates, role: "", dates };
}

/** "Senior Engineer    08/2023 – 02/2025" on its own line (company on previous line). */
function parseRoleDatesLine(text: string): { role: string; dates: string } | null {
  const dates = parseDatesFromLine(text);
  if (!dates) return null;
  const role = text.replace(DATE_PATTERN, "").replace(/,+\s*$/, "").trim();
  if (!role) return null;
  return { role, dates };
}

function isSectionHeader(text: string): boolean {
  return (
    SECTION_HEADERS.education.test(text) ||
    SECTION_HEADERS.experience.test(text) ||
    SECTION_HEADERS.skills.test(text) ||
    SECTION_HEADERS.summary.test(text)
  );
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
): { header: Pick<GeneratedResumeContent["experiences"][number], "company" | "role" | "dates">; skipNext: boolean } | null {
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

export function validateParsedExperiences(
  experiences: GeneratedResumeContent["experiences"]
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (experiences.length === 0) {
    errors.push("no experience entries found");
    return { ok: false, errors };
  }

  experiences.forEach((exp, index) => {
    const label = `Job ${index + 1}`;
    if (!exp.company.trim()) errors.push(`${label}: missing company`);
    else if (exp.company.length > 100) errors.push(`${label}: company name too long`);
    else if (looksLikeBulletSentence(exp.company)) errors.push(`${label}: company looks like bullet text`);
    else if (parseDatesFromLine(exp.company) && !exp.role.trim()) {
      errors.push(`${label}: company field looks like a combined header line`);
    }

    if (!exp.dates.trim()) errors.push(`${label}: missing dates`);
    if (!exp.role.trim()) errors.push(`${label}: missing role`);
    if (exp.bullets.length === 0) errors.push(`${label}: no bullets found`);
  });

  return errors.length ? { ok: false, errors } : { ok: true };
}

export function extractExperienceSectionPlainText(buffer: Buffer): string {
  const paragraphs = getDocxParagraphs(buffer);
  const expIdx = paragraphs.findIndex((p) => SECTION_HEADERS.experience.test(p.text));
  const eduIdx = paragraphs.findIndex((p) => SECTION_HEADERS.education.test(p.text));
  if (expIdx === -1) return "";

  const end = eduIdx === -1 ? paragraphs.length : eduIdx;
  return paragraphs
    .slice(expIdx + 1, end)
    .filter((p) => p.text && !isSectionHeader(p.text))
    .map((p) => (p.isListItem ? `• ${p.text}` : p.text))
    .join("\n");
}

function isContactLine(text: string): boolean {
  return (
    /https?:\/\//i.test(text) ||
    /@/.test(text) ||
    /linkedin\.com/i.test(text) ||
    /\+\d/.test(text) ||
    /\d{3}[-.\s]?\d{3,}/.test(text)
  );
}

export function parseResumeHeaderFromDocxBuffer(buffer: Buffer) {
  const zip = new PizZip(buffer);
  const xml = zip.file("word/document.xml")?.asText();
  if (!xml) throw new Error("Invalid docx: missing document.xml");

  const paragraphs = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
  const summaryIdx = findSectionIndex(paragraphs, SECTION_HEADERS.summary);
  if (summaryIdx === -1) throw new Error("SUMMARY section not found in template.");

  let name = "";
  let title = "";
  let titleParagraphIndex = -1;

  for (let i = 0; i < summaryIdx; i += 1) {
    const text = getParagraphText(paragraphs[i]).trim();
    if (!text || isContactLine(text)) continue;
    if (!name) {
      name = text;
      continue;
    }
    title = text;
    titleParagraphIndex = i;
    break;
  }

  return { name, title, titleParagraphIndex };
}

export function parseExperiencesFromDocxBuffer(buffer: Buffer) {
  const paragraphs = getDocxParagraphs(buffer);
  const expIdx = paragraphs.findIndex((p) => SECTION_HEADERS.experience.test(p.text));
  const eduIdx = paragraphs.findIndex((p) => SECTION_HEADERS.education.test(p.text));
  if (expIdx === -1) throw new Error("EXPERIENCE section not found in template.");

  const end = eduIdx === -1 ? paragraphs.length : eduIdx;
  const experiences: GeneratedResumeContent["experiences"] = [];

  let currentHeader: Pick<
    GeneratedResumeContent["experiences"][number],
    "company" | "role" | "dates"
  > | null = null;
  let bullets: string[] = [];

  const flush = () => {
    if (!currentHeader) return;
    experiences.push({ ...currentHeader, bullets: [...bullets] });
    currentHeader = null;
    bullets = [];
  };

  for (let i = expIdx + 1; i < end; i += 1) {
    const line = paragraphs[i];
    if (!line.text || isSectionHeader(line.text)) continue;

    if (line.isListItem) {
      if (currentHeader) bullets.push(line.text);
      continue;
    }

    const headerMatch = tryParseJobHeader(line, paragraphs[i + 1] ?? null);
    if (headerMatch) {
      flush();
      currentHeader = headerMatch.header;
      if (headerMatch.skipNext) i += 1;
      continue;
    }

    if (currentHeader && !parseDatesFromLine(line.text)) {
      bullets.push(line.text);
    }
  }

  flush();
  return experiences;
}

export function applyContentToDocx(
  buffer: Buffer,
  content: GeneratedResumeContent
): Buffer {
  const zip = new PizZip(buffer);
  const xml = zip.file("word/document.xml")?.asText();
  if (!xml) throw new Error("Invalid docx: missing document.xml");

  const paragraphs = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
  const summaryIdx = findSectionIndex(paragraphs, SECTION_HEADERS.summary);
  const skillsIdx = findSectionIndex(paragraphs, SECTION_HEADERS.skills);
  const expIdx = findSectionIndex(paragraphs, SECTION_HEADERS.experience);
  const eduIdx = findSectionIndex(paragraphs, SECTION_HEADERS.education);

  if (summaryIdx === -1 || skillsIdx === -1 || expIdx === -1) {
    throw new Error("Template must contain SUMMARY, SKILLS, and EXPERIENCE sections.");
  }

  const header = parseResumeHeaderFromDocxBuffer(buffer);
  if (content.title && header.titleParagraphIndex >= 0) {
    paragraphs[header.titleParagraphIndex] = setParagraphText(
      paragraphs[header.titleParagraphIndex],
      content.title
    );
  }

  paragraphs[summaryIdx + 1] = setParagraphText(paragraphs[summaryIdx + 1], content.summary);
  paragraphs[skillsIdx + 1] = setParagraphText(paragraphs[skillsIdx + 1], content.skills);

  const expEnd = eduIdx === -1 ? paragraphs.length : eduIdx;
  const originalExperienceParagraphs = paragraphs.slice(expIdx + 1, expEnd);
  const headerSample = getParagraphText(paragraphs[expIdx + 1] ?? "").trim();
  const useCombinedHeaders = parseCombinedExperienceLine(headerSample) !== null;
  const styleBlocks = extractExperienceStyleBlocks(originalExperienceParagraphs, useCombinedHeaders);
  const defaultHeaderTemplate = paragraphs[expIdx + 1];
  const defaultRoleTemplate = paragraphs[expIdx + 2];
  const defaultBulletTemplate = useCombinedHeaders
    ? paragraphs[expIdx + 2] ?? paragraphs[expIdx + 1]
    : paragraphs[expIdx + 3] ?? paragraphs[expIdx + 2];

  const experienceParagraphs: string[] = [];
  for (let jobIndex = 0; jobIndex < content.experiences.length; jobIndex += 1) {
    const exp = content.experiences[jobIndex];
    const style =
      styleBlocks[jobIndex] ??
      styleBlocks[styleBlocks.length - 1] ?? {
        headerTemplate: defaultHeaderTemplate,
        roleTemplate: useCombinedHeaders ? undefined : defaultRoleTemplate,
        bulletTemplate: defaultBulletTemplate,
      };

    if (useCombinedHeaders) {
      const headerText = exp.dates
        ? `${exp.role}, ${exp.company}, ${exp.dates}`
        : `${exp.role}, ${exp.company}`;
      experienceParagraphs.push(setParagraphText(style.headerTemplate, headerText));
    } else {
      experienceParagraphs.push(setParagraphText(style.headerTemplate, exp.company));
      const roleDates = exp.dates ? `${exp.role}    ${exp.dates}` : exp.role;
      experienceParagraphs.push(
        setParagraphText(style.roleTemplate ?? defaultRoleTemplate, roleDates)
      );
    }

    for (const bullet of exp.bullets) {
      experienceParagraphs.push(setParagraphText(style.bulletTemplate, bullet));
    }
  }

  applyPageBreaksFromTemplate(experienceParagraphs, originalExperienceParagraphs);

  const updatedParagraphs = [
    ...paragraphs.slice(0, expIdx + 1),
    ...experienceParagraphs,
    ...paragraphs.slice(expEnd),
  ];

  const bodyStart = xml.indexOf("<w:body>");
  const bodyEnd = xml.indexOf("</w:body>");
  if (bodyStart === -1 || bodyEnd === -1) {
    throw new Error("Invalid docx: missing w:body.");
  }

  const sectPr = xml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0] ?? "";
  const rebuilt =
    xml.slice(0, bodyStart + "<w:body>".length) +
    updatedParagraphs.join("") +
    sectPr +
    xml.slice(bodyEnd);

  zip.file("word/document.xml", rebuilt);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
