import PizZip from "pizzip";
import {
  boldSkillTermsInText,
  extractSkillTerms,
} from "@/lib/resume-content-postprocess";
import {
  buildProjectExperienceParagraphs,
  detectProjectTemplateLayout,
  parseProjectExperiencesFromDocxBuffer,
  type ProjectJobTemplate,
} from "@/lib/resume-docx-project";
import type { GeneratedResumeContent, ResumeTemplateLayout } from "@/lib/resume-types";

const SECTION_HEADERS = {
  summary: /^(SUMMARY|Summary|PROFESSIONAL SUMMARY|Professional Summary)$/i,
  skills: /^(SKILLS|Skills|SKILLSETS|Skillsets|TECHNICAL SKILLS|Technical Skills)$/i,
  experience:
    /^(EXPERIENCE|Experience|WORK EXPERIENCE|Work Experience|PROFESSIONAL EXPERIENCE|Professional Experience|EMPLOYMENT|Employment)$/i,
  education: /^(EDUCATION|Education)$/i,
};

const SKILLS_EXPERIENCE_GAP_AFTER_TWIPS = 40;

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

function sanitizeForXml(text: string): string {
  // XML 1.0 forbids most control characters; LibreOffice rejects malformed document.xml.
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g, "");
}

function escapeXml(text: string): string {
  return sanitizeForXml(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

export function getParagraphText(pXml: string): string {
  const raw = (pXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
    .map((t) => t.replace(/<w:t[^>]*>/, "").replace(/<\/w:t>/, ""))
    .join("");
  return decodeXmlEntities(raw);
}

/** Plain text with **bold** markers from Word run properties. */
const TEXT_RUN_PATTERN = /<w:r\b[^>]*>[\s\S]*?<\/w:r>/g;

function matchTextRuns(pXml: string): string[] {
  return pXml.match(TEXT_RUN_PATTERN) ?? [];
}

export { matchTextRuns };

export function getParagraphTextWithBold(pXml: string): string {
  const runs = matchTextRuns(pXml);
  if (runs.length === 0) return getParagraphText(pXml);

  let out = "";
  for (const run of runs) {
    const text = (run.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [])
      .map((t) => {
        const match = t.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
        return match?.[1] ?? "";
      })
      .join("");
    if (!text) continue;
    const decoded = decodeXmlEntities(text);
    const isBold = /<w:b(?:\s[^>]*)?\/>|<w:b(?:\s[^>]*)?>[^<]*<\/w:b>/.test(run);
    out += isBold ? `**${decoded}**` : decoded;
  }

  return out || getParagraphText(pXml);
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

export function setParagraphText(pXml: string, text: string): string {
  if (!text.includes("**")) {
    const preserved = replaceSingleRunParagraphText(pXml, text);
    if (preserved) return preserved;
  }

  const open = pXml.match(/^(<w:p[^>]*>)/)?.[1] ?? "<w:p>";
  const pPr = extractParagraphProperties(pXml);
  const runs = buildRunsFromMarkdownText(pXml, text);
  return `${open}${pPr}${runs}</w:p>`;
}

/** Keep full run/rPr XML when the paragraph has a single text run (typical bullets/headers). */
function replaceSingleRunParagraphText(pXml: string, text: string): string | null {
  const runs = matchTextRuns(pXml);
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
  const fromRun = pXml.match(/<w:r\b[^>]*>[\s\S]*?<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0];
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

function extractRunProperties(runXml: string): string {
  return runXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
}

/** Latin bold (`<w:b/>`) — templates often only set `<w:bCs/>`, which does not bold category labels. */
function hasLatinBold(rPr: string): boolean {
  const tag = rPr.match(/<w:b(?!Cs)\b[^>]*\/?>/)?.[0] ?? "";
  if (!tag) return false;
  return !/w:val="(?:0|false)"/.test(tag);
}

function ensureLatinBoldRunProperties(rPr: string): string {
  if (hasLatinBold(rPr)) return rPr;
  if (!rPr) return "<w:rPr><w:b/></w:rPr>";
  return rPr.replace("</w:rPr>", "<w:b/></w:rPr>");
}

function stripBoldRunProperties(rPr: string): string {
  return rPr
    .replace(/<w:b(?!Cs)\b[^/]*\/>/g, "")
    .replace(/<w:b(?!Cs)\b[^>]*>[\s\S]*?<\/w:b>/g, "")
    .replace(/<w:bCs\b[^/]*\/>/g, "")
    .replace(/<w:bCs\b[^>]*>[\s\S]*?<\/w:bCs>/g, "");
}

function getRunPlainText(runXml: string): string {
  return decodeXmlEntities(
    (runXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [])
      .map((t) => t.replace(/<w:t[^>]*>/, "").replace(/<\/w:t>/, ""))
      .join("")
  );
}

/** True when every non-empty text run in the paragraph is bold (template job-header style). */
export function paragraphXmlIsFullyBold(pXml: string): boolean {
  const textRuns = matchTextRuns(pXml).filter((run) => getRunPlainText(run).trim().length > 0);
  if (textRuns.length === 0) return false;
  return textRuns.every((run) => /<w:b(?:\s[^>]*)?\/>|<w:b(?:\s[^>]*)?>/.test(run));
}

export function boldEntirePlainText(text: string): string {
  const plain = text.replace(/\*\*/g, "").trim();
  return plain ? `**${plain}**` : "";
}

export function formatExperienceRoleText(
  role: string,
  templateXml: string,
  boldSkillTerms: (text: string) => string
): string {
  if (paragraphXmlIsFullyBold(templateXml)) {
    return boldEntirePlainText(role);
  }
  return boldSkillTerms(role);
}

export function formatCombinedExperienceHeaderText(
  role: string,
  company: string,
  dates: string,
  templateXml: string,
  boldSkillTerms: (text: string) => string
): string {
  const plainRole = role.replace(/\*\*/g, "").trim();
  const line = dates ? `${plainRole}, ${company}, ${dates}` : `${plainRole}, ${company}`;
  if (paragraphXmlIsFullyBold(templateXml)) {
    return boldEntirePlainText(line);
  }
  return dates
    ? `${boldSkillTerms(role)}, ${company}, ${dates}`
    : `${boldSkillTerms(role)}, ${company}`;
}

function hasLatinItalic(rPr: string): boolean {
  const tag = rPr.match(/<w:i(?!Cs)\b[^>]*\/?>/)?.[0] ?? "";
  if (!tag) return false;
  return !/w:val="(?:0|false)"/.test(tag);
}

function hasUnderline(rPr: string): boolean {
  const tag = rPr.match(/<w:u\b[^>]*\/?>/)?.[0] ?? "";
  if (!tag) return false;
  return !/w:val="(?:none|false)"/.test(tag);
}

function runFormattingScore(rPr: string): number {
  let score = 0;
  if (hasLatinBold(rPr)) score += 4;
  if (hasLatinItalic(rPr)) score += 2;
  if (hasUnderline(rPr)) score += 1;
  return score;
}

function stripItalicRunProperties(rPr: string): string {
  return rPr
    .replace(/<w:i(?!Cs)\b[^/]*\/>/g, "")
    .replace(/<w:i(?!Cs)\b[^>]*>[\s\S]*?<\/w:i>/g, "")
    .replace(/<w:iCs\b[^/]*\/>/g, "")
    .replace(/<w:iCs\b[^>]*>[\s\S]*?<\/w:iCs>/g, "");
}

function stripUnderlineRunProperties(rPr: string): string {
  return rPr
    .replace(/<w:u\b[^/]*\/>/g, "")
    .replace(/<w:u\b[^>]*>[\s\S]*?<\/w:u>/g, "");
}

function stripDecorations(rPr: string): string {
  return stripUnderlineRunProperties(stripItalicRunProperties(stripBoldRunProperties(rPr)));
}

function pickLabelRunProperties(runs: string[]): string {
  let best = "";
  let bestScore = -1;
  for (const run of runs) {
    if (!/<w:t[\s\S]*?<\/w:t>/.test(run)) continue;
    const rPr = extractRunProperties(run);
    const score = runFormattingScore(rPr);
    if (score > bestScore) {
      bestScore = score;
      best = rPr;
    }
  }
  return best;
}

function pickValueRunProperties(runs: string[]): string {
  let best = "";
  let bestLen = 0;

  for (const run of runs) {
    if (!/<w:t[\s\S]*?<\/w:t>/.test(run)) continue;
    const text = getRunPlainText(run).trim();
    if (!text || text === ":" || text.length < 8) continue;
    const rPr = extractRunProperties(run);
    if (runFormattingScore(rPr) > 0) continue;
    if (text.length > bestLen) {
      bestLen = text.length;
      best = rPr;
    }
  }
  if (best) return best;

  for (const run of runs) {
    if (!/<w:t[\s\S]*?<\/w:t>/.test(run)) continue;
    const text = getRunPlainText(run).trim();
    if (text.length < 8) continue;
    const stripped = stripDecorations(extractRunProperties(run));
    if (text.length > bestLen) {
      bestLen = text.length;
      best = stripped;
    }
  }
  return best;
}

function buildRunsFromMarkdownWithProperties(
  text: string,
  boldRPr: string,
  plainRPr: string,
  options?: { prefix?: string }
): string {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return `<w:r>${plainRPr}<w:t xml:space="preserve"></w:t></w:r>`;
  }

  let prefixApplied = false;
  return parts
    .map((part) => {
      const boldMatch = /^\*\*([^*]+)\*\*$/.exec(part);
      const content = boldMatch ? boldMatch[1] : part;
      const rPr = boldMatch ? boldRPr : plainRPr;
      const withPrefix = !prefixApplied && options?.prefix ? `${options.prefix}${content}` : content;
      if (!prefixApplied && options?.prefix) prefixApplied = true;
      return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(withPrefix)}</w:t></w:r>`;
    })
    .join("");
}

function buildRunsFromMarkdownText(pXml: string, text: string): string {
  const runs = matchTextRuns(pXml);
  const baseRPr = extractBaseRunProperties(pXml);
  const labelRPr = pickLabelRunProperties(runs) || ensureLatinBoldRunProperties(baseRPr);
  const valueRPr =
    pickValueRunProperties(runs) || stripDecorations(baseRPr) || baseRPr;

  return buildRunsFromMarkdownWithProperties(text, labelRPr, valueRPr);
}

function parseSkillCategoryLine(line: string): { label: string; value: string } | null {
  const trimmed = line.trim();
  const markdown = trimmed.match(/^\*\*([^*:]+):\*\*\s*(.*)$/);
  if (markdown) {
    const label = decodeXmlEntities(markdown[1].replace(/\*\*/g, "")).trim();
    const value = markdown[2].replace(/\*\*/g, "").trim();
    return label ? { label, value } : null;
  }
  const plain = trimmed.match(/^([^:]+):\s*(.*)$/);
  if (plain) {
    const label = decodeXmlEntities(plain[1].replace(/\*\*/g, "")).trim();
    const value = plain[2].replace(/\*\*/g, "").trim();
    return label ? { label, value } : null;
  }
  return null;
}

function replaceRunText(runXml: string, text: string): string {
  if (!/<w:t[\s\S]*?<\/w:t>/.test(runXml)) return runXml;
  return runXml.replace(
    /<w:t[^>]*>[\s\S]*?<\/w:t>/,
    `<w:t xml:space="preserve">${escapeXml(text)}</w:t>`
  );
}

/** Rebuild category skill lines with two runs — multi-run templates break LibreOffice PDF conversion. */
function setSkillLineParagraphText(pXml: string, line: string): string {
  const trimmed = line.trim();
  const parsed = parseSkillCategoryLine(trimmed);
  if (!parsed) return setParagraphText(pXml, trimmed);

  const open = pXml.match(/^(<w:p[^>]*>)/)?.[1] ?? "<w:p>";
  const pPr = extractParagraphProperties(pXml);
  const runs = matchTextRuns(pXml);

  let boldLabelRPr = "";
  let plainRPr = "";
  for (const run of runs) {
    if (!/<w:t[\s\S]*?<\/w:t>/.test(run)) continue;
    const isBold = /<w:b(?:\s[^>]*)?\/>|<w:b(?:\s[^>]*)?>[^<]*<\/w:b>/.test(run);
    if (isBold && !boldLabelRPr) {
      boldLabelRPr = ensureLatinBoldRunProperties(extractRunProperties(run));
    }
    if (!isBold && !plainRPr) {
      const stripped = stripBoldRunProperties(extractRunProperties(run));
      plainRPr = stripped || extractRunProperties(run);
    }
  }

  const baseRPr = extractBaseRunProperties(pXml);
  if (!boldLabelRPr) boldLabelRPr = ensureLatinBoldRunProperties(baseRPr);
  if (!plainRPr) plainRPr = stripBoldRunProperties(baseRPr) || baseRPr;

  const { label, value } = parsed;
  const labelRun = `<w:r>${boldLabelRPr}<w:t xml:space="preserve">${escapeXml(`${label}:`)}</w:t></w:r>`;
  const valueRun = value
    ? `<w:r>${plainRPr}<w:t xml:space="preserve"> ${escapeXml(value)}</w:t></w:r>`
    : "";

  return `${open}${pPr}${labelRun}${valueRun}</w:p>`;
}

/** Project BAR labels (Business Challenge, Action, etc.) — preserve bold/italic/underline from template. */
function inferBarFieldSeparator(pXml: string): { labelSuffix: string; valuePrefix: string } {
  const textRuns = matchTextRuns(pXml).filter((run) => /<w:t[\s\S]*?<\/w:t>/.test(run));
  if (textRuns.length >= 2) {
    const secondText = getRunPlainText(textRuns[1]);
    const colonPrefix = secondText.match(/^(:[\s]*)/);
    if (colonPrefix) {
      return { labelSuffix: "", valuePrefix: colonPrefix[1] };
    }
  }
  return { labelSuffix: ":", valuePrefix: " " };
}

export function setBarFieldParagraphText(pXml: string, label: string, value: string): string {
  const open = pXml.match(/^(<w:p[^>]*>)/)?.[1] ?? "<w:p>";
  const pPr = extractParagraphProperties(pXml);
  const runs = matchTextRuns(pXml);

  const baseRPr = extractBaseRunProperties(pXml);
  let labelRPr = pickLabelRunProperties(runs);
  let valueRPr = pickValueRunProperties(runs);
  if (!labelRPr) labelRPr = ensureLatinBoldRunProperties(baseRPr);
  if (!valueRPr) valueRPr = stripDecorations(baseRPr) || baseRPr;

  const trimmedLabel = label.trim().replace(/:+\s*$/, "");
  const { labelSuffix, valuePrefix } = inferBarFieldSeparator(pXml);
  const labelRun = `<w:r>${labelRPr}<w:t xml:space="preserve">${escapeXml(`${trimmedLabel}${labelSuffix}`)}</w:t></w:r>`;
  const trimmedValue = value.trim();
  const skillBoldRPr = ensureLatinBoldRunProperties(valueRPr);
  const valueRuns = trimmedValue
    ? buildRunsFromMarkdownWithProperties(trimmedValue, skillBoldRPr, valueRPr, { prefix: valuePrefix })
    : "";

  return `${open}${pPr}${labelRun}${valueRuns}</w:p>`;
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

export type TemplateContentSamples = {
  layout: ResumeTemplateLayout;
  summary: string;
  skills: string;
  sampleBullets: string[];
  sampleProjects: Array<{
    name: string;
    businessChallenge: string;
    assignedResponsibility: string;
    action: string;
    result: string;
  }>;
};

export function detectResumeTemplateLayout(buffer: Buffer): ResumeTemplateLayout {
  return detectProjectTemplateLayout(buffer) ? "projects" : "bullets";
}

function collectSectionParagraphIndices(
  paragraphs: string[],
  headerIdx: number,
  endIdx: number
): number[] {
  const indices: number[] = [];
  for (let i = headerIdx + 1; i < endIdx; i += 1) {
    const text = getParagraphText(paragraphs[i]).trim();
    if (text && !isSectionHeader(text)) indices.push(i);
  }
  return indices;
}

/** Characters commonly used as typed horizontal rules in Word templates. */
const HORIZONTAL_RULE_TEXT = /^[\s_\u2013\u2014\u2015\u2212\u2500\u2501\u002D\uFF0D=·.•]{3,}$/;

function extractParagraphProperties(pXml: string): string {
  return pXml.match(/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
}

/** True when the paragraph is a decorative horizontal rule (border, drawing, or rule characters). */
export function isHorizontalRuleParagraph(pXml: string): boolean {
  const text = getParagraphText(pXml).trim();
  if (text && HORIZONTAL_RULE_TEXT.test(text)) return true;
  if (text) return false;

  const pPr = extractParagraphProperties(pXml);
  if (/<w:pBdr\b/i.test(pPr) || /<w:bottom\b/i.test(pPr) || /<w:top\b/i.test(pPr)) return true;
  if (/<w:drawing\b/i.test(pXml) || /<w:pict\b/i.test(pXml) || /<v:line\b/i.test(pXml)) return true;
  return false;
}

function isSectionSpacerParagraph(pXml: string): boolean {
  const text = getParagraphText(pXml).trim();
  if (!text) return true;
  return isHorizontalRuleParagraph(pXml);
}

type SectionRegionParts = {
  leadingEmpty: string[];
  contentTemplates: string[];
  trailingEmpty: string[];
};

function partitionSectionRegion(regionParagraphs: string[]): SectionRegionParts {
  const leadingEmpty: string[] = [];
  const contentTemplates: string[] = [];
  const trailingEmpty: string[] = [];
  let phase: "leading" | "content" | "trailing" = "leading";

  for (const paragraph of regionParagraphs) {
    const spacer = isSectionSpacerParagraph(paragraph);
    if (phase === "leading") {
      if (spacer) leadingEmpty.push(paragraph);
      else {
        contentTemplates.push(paragraph);
        phase = "content";
      }
    } else if (phase === "content") {
      if (spacer) {
        trailingEmpty.push(paragraph);
        phase = "trailing";
      } else {
        contentTemplates.push(paragraph);
      }
    } else if (spacer) {
      trailingEmpty.push(paragraph);
    } else {
      // Non-spacer after trailing rules — treat as more content (rare), keep prior rules before it.
      contentTemplates.push(...trailingEmpty, paragraph);
      trailingEmpty.length = 0;
      phase = "content";
    }
  }

  return { leadingEmpty, contentTemplates, trailingEmpty };
}

/** Keep decorative rule paragraphs intact — never rewrite their runs. */
function preserveSpacerParagraphs(paragraphs: string[]): string[] {
  return paragraphs.map((paragraph) =>
    isHorizontalRuleParagraph(paragraph) ? paragraph : setParagraphText(paragraph, "")
  );
}

function buildSectionParagraphs(
  regionParagraphs: string[],
  content: string,
  renderLine: (template: string, line: string) => string
): string[] {
  if (regionParagraphs.length === 0) return [];

  const { leadingEmpty, contentTemplates, trailingEmpty } = partitionSectionRegion(regionParagraphs);
  const lines = content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const fallback =
    contentTemplates[contentTemplates.length - 1] ??
    regionParagraphs.find(
      (paragraph) => getParagraphText(paragraph).trim() && !isHorizontalRuleParagraph(paragraph)
    ) ??
    regionParagraphs[0];

  if (lines.length === 0) {
    return [
      ...preserveSpacerParagraphs(leadingEmpty),
      ...contentTemplates.map((paragraph) => setParagraphText(paragraph, "")),
      ...preserveSpacerParagraphs(trailingEmpty),
    ];
  }

  if (contentTemplates.length <= 1) {
    const merged = lines.join(contentTemplates.length === 0 ? "\n" : " ");
    return [
      ...preserveSpacerParagraphs(leadingEmpty),
      renderLine(fallback, merged),
      ...preserveSpacerParagraphs(trailingEmpty),
    ];
  }

  const rendered = lines.map((line, index) =>
    renderLine(contentTemplates[index] ?? fallback, line)
  );
  return [
    ...preserveSpacerParagraphs(leadingEmpty),
    ...rendered,
    ...preserveSpacerParagraphs(trailingEmpty),
  ];
}

function setParagraphSpacing(pXml: string, beforeTwips: number, afterTwips: number): string {
  const spacingTag = `<w:spacing w:before="${beforeTwips}" w:after="${afterTwips}"/>`;
  if (/<w:pPr[\s\S]*?<\/w:pPr>/.test(pXml)) {
    if (/<w:spacing[^/]*\/>/.test(pXml)) {
      return pXml.replace(/<w:spacing[^/]*\/>/, spacingTag);
    }
    return pXml.replace(/<w:pPr([^>]*)>/, `<w:pPr$1>${spacingTag}`);
  }
  const open = pXml.match(/^(<w:p[^>]*>)/)?.[1] ?? "<w:p>";
  const rest = pXml.slice(open.length);
  return `${open}<w:pPr>${spacingTag}</w:pPr>${rest}`;
}

function applySkillsExperienceGap(trailingEmpty: string[]): string[] {
  if (trailingEmpty.length === 0) return trailingEmpty;
  const last = trailingEmpty[trailingEmpty.length - 1];
  // Never rewrite a decorative horizontal rule — only adjust plain spacers.
  if (isHorizontalRuleParagraph(last)) {
    return trailingEmpty.map((paragraph) =>
      isHorizontalRuleParagraph(paragraph) ? paragraph : setParagraphText(paragraph, "")
    );
  }
  return [
    ...trailingEmpty.slice(0, -1).map((paragraph) =>
      isHorizontalRuleParagraph(paragraph) ? paragraph : setParagraphText(paragraph, "")
    ),
    setParagraphSpacing(setParagraphText(last, ""), 0, SKILLS_EXPERIENCE_GAP_AFTER_TWIPS),
  ];
}

function buildSkillsRegionParagraphs(regionParagraphs: string[], skillsContent: string): string[] {
  const { leadingEmpty, contentTemplates, trailingEmpty } = partitionSectionRegion(regionParagraphs);
  const lines = skillsContent
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0 || contentTemplates.length === 0) {
    return buildSectionParagraphs(regionParagraphs, skillsContent, setSkillLineParagraphText);
  }

  const fallback = contentTemplates[contentTemplates.length - 1];
  const skillParagraphs = lines.map((line, index) =>
    setSkillLineParagraphText(contentTemplates[index] ?? fallback, line)
  );

  const gapTrailing =
    trailingEmpty.length > 0
      ? applySkillsExperienceGap(trailingEmpty)
      : applySkillsExperienceGap([setParagraphText(fallback, "")]);

  return [
    ...preserveSpacerParagraphs(leadingEmpty),
    ...skillParagraphs,
    ...gapTrailing,
  ];
}

/**
 * Detect a "Name <sep> Title" combined header line (e.g. "Franco Torrez | Senior Software Engineer").
 * Returns the name portion and the separator (including surrounding spaces) so the title can be swapped.
 */
function splitCombinedNameTitle(text: string): { name: string; separator: string } | null {
  const match = text.match(/^(.+?)(\s+[|\u2013\u2014\u00b7\u2022\u00b0]\s+|\s+-\s+)(.+)$/);
  if (!match) return null;
  const name = match[1].trim();
  if (!name) return null;
  return { name, separator: match[2] };
}

/**
 * Apply the generated resume title to the header region (paragraphs before SUMMARY).
 * Returns a new array; may insert a paragraph when the template has no dedicated title line,
 * so the title always renders as a headline directly under the name.
 */
function applyTitleToHeaderRegion(
  headerParagraphs: string[],
  title: string,
  titleParagraphIndex: number
): string[] {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return headerParagraphs;

  const paragraphs = [...headerParagraphs];

  // 1. Template has a dedicated title line right under the name — replace it in place.
  if (titleParagraphIndex >= 0 && titleParagraphIndex < paragraphs.length) {
    paragraphs[titleParagraphIndex] = setParagraphText(paragraphs[titleParagraphIndex], trimmedTitle);
    return paragraphs;
  }

  // 2. No dedicated title line: find the name line (first non-empty, non-contact paragraph).
  let nameIdx = -1;
  for (let i = 0; i < paragraphs.length; i += 1) {
    const text = getParagraphText(paragraphs[i]).trim();
    if (!text || isContactLine(text)) continue;
    nameIdx = i;
    break;
  }
  if (nameIdx === -1) return paragraphs;

  // 2a. Name and title share one line ("Name | Title") — replace only the title portion.
  const combined = splitCombinedNameTitle(getParagraphText(paragraphs[nameIdx]).trim());
  if (combined) {
    paragraphs[nameIdx] = setParagraphText(
      paragraphs[nameIdx],
      `${combined.name}${combined.separator}${trimmedTitle}`
    );
    return paragraphs;
  }

  // 2b. Reuse an empty spacer immediately after the name (keeps template spacing).
  // Skip decorative horizontal-rule paragraphs so section lines are not overwritten.
  const afterName = paragraphs[nameIdx + 1];
  if (
    afterName !== undefined &&
    !getParagraphText(afterName).trim() &&
    !isHorizontalRuleParagraph(afterName)
  ) {
    paragraphs[nameIdx + 1] = setParagraphText(afterName, trimmedTitle);
    return paragraphs;
  }

  // 2c. Otherwise insert a new headline paragraph right under the name (clone the name style).
  paragraphs.splice(nameIdx + 1, 0, setParagraphText(paragraphs[nameIdx], trimmedTitle));
  return paragraphs;
}

function sliceSectionRegion(
  paragraphs: string[],
  headerIdx: number,
  endIdx: number
): string[] {
  return paragraphs.slice(headerIdx + 1, endIdx).filter((paragraph) => {
    const text = getParagraphText(paragraph).trim();
    return !text || !isSectionHeader(text);
  });
}

/** Extract summary, skills, and sample bullets from the template for style-matching prompts. */
export function parseTemplateContentSamples(buffer: Buffer): TemplateContentSamples {
  const zip = new PizZip(buffer);
  const xml = zip.file("word/document.xml")?.asText();
  if (!xml) throw new Error("Invalid docx: missing document.xml");

  const paragraphXml = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
  const summaryIdx = findSectionIndex(paragraphXml, SECTION_HEADERS.summary);
  const skillsIdx = findSectionIndex(paragraphXml, SECTION_HEADERS.skills);
  const expIdx = findSectionIndex(paragraphXml, SECTION_HEADERS.experience);
  const eduIdx = findSectionIndex(paragraphXml, SECTION_HEADERS.education);

  const layout = detectResumeTemplateLayout(buffer);

  if (summaryIdx === -1 || skillsIdx === -1 || expIdx === -1) {
    return { layout, summary: "", skills: "", sampleBullets: [], sampleProjects: [] };
  }

  const summaryIndices = collectSectionParagraphIndices(paragraphXml, summaryIdx, skillsIdx);
  const skillsIndices = collectSectionParagraphIndices(paragraphXml, skillsIdx, expIdx);

  const summary = summaryIndices
    .map((i) => getParagraphTextWithBold(paragraphXml[i]))
    .join("\n")
    .trim();

  const skills = skillsIndices
    .map((i) => getParagraphTextWithBold(paragraphXml[i]))
    .join("\n")
    .trim();

  const expEnd = eduIdx === -1 ? paragraphXml.length : eduIdx;
  const sampleBullets: string[] = [];
  const sampleProjects: TemplateContentSamples["sampleProjects"] = [];

  if (layout === "projects") {
    try {
      const { jobTemplates } = parseProjectExperiencesFromDocxBuffer(buffer);
      for (const job of jobTemplates) {
        for (const project of job.projects) {
          if (sampleProjects.length >= 2) break;
          sampleProjects.push({ ...project });
        }
        if (sampleProjects.length >= 2) break;
      }
    } catch {
      // fall through with empty samples
    }
  } else {
    for (let i = expIdx + 1; i < expEnd && sampleBullets.length < 4; i += 1) {
      const text = getParagraphText(paragraphXml[i]).trim();
      if (!text || isSectionHeader(text)) continue;
      if (isListParagraph(paragraphXml[i]) && text.length >= 40) {
        sampleBullets.push(getParagraphTextWithBold(paragraphXml[i]));
      }
    }
  }

  return { layout, summary, skills, sampleBullets, sampleProjects };
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
  if (summaryIdx >= skillsIdx || skillsIdx >= expIdx) {
    throw new Error("Template sections are out of order. Expected SUMMARY → SKILLS → EXPERIENCE.");
  }

  const header = parseResumeHeaderFromDocxBuffer(buffer);
  const headerParagraphs = applyTitleToHeaderRegion(
    paragraphs.slice(0, summaryIdx),
    content.title,
    header.titleParagraphIndex
  );

  const summaryRegion = sliceSectionRegion(paragraphs, summaryIdx, skillsIdx);
  const summaryBody = buildSectionParagraphs(summaryRegion, content.summary, setParagraphText);

  const skillsRegion = sliceSectionRegion(paragraphs, skillsIdx, expIdx);
  const skillsBody = buildSkillsRegionParagraphs(skillsRegion, content.skills);

  const expEnd = eduIdx === -1 ? paragraphs.length : eduIdx;
  const originalExperienceParagraphs = paragraphs.slice(expIdx + 1, expEnd);
  const layout = content.layout ?? detectResumeTemplateLayout(buffer);
  const skillTerms = extractSkillTerms(content.skills);
  const boldExpText = (text: string) => boldSkillTermsInText(text, skillTerms);

  let experienceParagraphs: string[] = [];

  if (layout === "projects") {
    const { jobTemplates } = parseProjectExperiencesFromDocxBuffer(buffer);
    experienceParagraphs = buildProjectExperienceParagraphs(
      { ...content, layout: "projects" },
      jobTemplates as ProjectJobTemplate[],
      setParagraphText,
      skillTerms
    );
  } else {
    const headerSample = getParagraphText(paragraphs[expIdx + 1] ?? "").trim();
    const useCombinedHeaders = parseCombinedExperienceLine(headerSample) !== null;
    const styleBlocks = extractExperienceStyleBlocks(originalExperienceParagraphs, useCombinedHeaders);
    const defaultHeaderTemplate = paragraphs[expIdx + 1];
    const defaultRoleTemplate = paragraphs[expIdx + 2];
    const defaultBulletTemplate = useCombinedHeaders
      ? paragraphs[expIdx + 2] ?? paragraphs[expIdx + 1]
      : paragraphs[expIdx + 3] ?? paragraphs[expIdx + 2];

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
        const headerText = formatCombinedExperienceHeaderText(
          exp.role,
          exp.company,
          exp.dates,
          style.headerTemplate,
          boldExpText
        );
        experienceParagraphs.push(setParagraphText(style.headerTemplate, headerText));
      } else {
        experienceParagraphs.push(setParagraphText(style.headerTemplate, exp.company));
        const roleDates = exp.dates
          ? `${formatExperienceRoleText(exp.role, style.roleTemplate ?? defaultRoleTemplate, boldExpText)}    ${exp.dates}`
          : formatExperienceRoleText(exp.role, style.roleTemplate ?? defaultRoleTemplate, boldExpText);
        experienceParagraphs.push(
          setParagraphText(style.roleTemplate ?? defaultRoleTemplate, roleDates)
        );
      }

      for (const bullet of exp.bullets) {
        experienceParagraphs.push(setParagraphText(style.bulletTemplate, boldExpText(bullet)));
      }
    }
  }

  applyPageBreaksFromTemplate(experienceParagraphs, originalExperienceParagraphs);

  const updatedParagraphs = [
    ...headerParagraphs,
    paragraphs[summaryIdx],
    ...summaryBody,
    paragraphs[skillsIdx],
    ...skillsBody,
    paragraphs[expIdx],
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
