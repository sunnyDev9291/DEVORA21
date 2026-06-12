import PizZip from "pizzip";
import type { GeneratedResumeContent } from "@/lib/resume-types";

const SECTION_HEADERS = {
  summary: /^(SUMMARY|Summary)$/i,
  skills: /^(SKILLS|Skills|SKILLSETS|Skillsets)$/i,
  experience: /^(EXPERIENCE|Experience)$/i,
  education: /^(EDUCATION|Education)$/i,
};

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

function setParagraphText(pXml: string, text: string): string {
  const open = pXml.match(/^(<w:p[^>]*>)/)?.[1] ?? "<w:p>";
  const pPr = pXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
  const escaped = escapeXml(text);
  return `${open}${pPr}<w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
}

function findSectionIndex(paragraphs: string[], pattern: RegExp): number {
  return paragraphs.findIndex((p) => pattern.test(getParagraphText(p).trim()));
}

function isRoleLine(text: string): boolean {
  return /\d{2}\/\d{4}|\d{4}\s*[-–—]/.test(text);
}

export function parseExperiencesFromDocxBuffer(buffer: Buffer) {
  const zip = new PizZip(buffer);
  const xml = zip.file("word/document.xml")?.asText();
  if (!xml) throw new Error("Invalid docx: missing document.xml");

  const paragraphs = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
  const expIdx = findSectionIndex(paragraphs, SECTION_HEADERS.experience);
  const eduIdx = findSectionIndex(paragraphs, SECTION_HEADERS.education);
  if (expIdx === -1) throw new Error("EXPERIENCE section not found in template.");

  const end = eduIdx === -1 ? paragraphs.length : eduIdx;
  const experiences: GeneratedResumeContent["experiences"] = [];

  let i = expIdx + 1;
  while (i < end) {
    const company = getParagraphText(paragraphs[i]).trim();
    const roleLine = getParagraphText(paragraphs[i + 1] ?? "").trim();

    if (!company || !isRoleLine(roleLine)) {
      i += 1;
      continue;
    }

    let role = roleLine;
    let dates = "";
    const dateMatch = roleLine.match(
      /(\d{2}\/\d{4}\s*[-–—]\s*(?:\d{2}\/\d{4}|Present|Current)|\d{4}\s*[-–—]\s*\d{4})/i
    );
    if (dateMatch) {
      dates = dateMatch[0].replace(/\s+/g, " ").trim();
      role = roleLine.replace(dateMatch[0], "").replace(/,+\s*$/, "").trim();
    }

    const bullets: string[] = [];
    i += 2;
    while (i < end) {
      const line = getParagraphText(paragraphs[i]).trim();
      if (!line) {
        i += 1;
        continue;
      }
      const next = getParagraphText(paragraphs[i + 1] ?? "").trim();
      if (next && isRoleLine(next)) break;
      if (SECTION_HEADERS.education.test(line)) break;
      bullets.push(line);
      i += 1;
    }

    experiences.push({ company, role, dates, bullets });
  }

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

  paragraphs[summaryIdx + 1] = setParagraphText(paragraphs[summaryIdx + 1], content.summary);
  paragraphs[skillsIdx + 1] = setParagraphText(paragraphs[skillsIdx + 1], content.skills);

  const expEnd = eduIdx === -1 ? paragraphs.length : eduIdx;
  const companyTemplate = paragraphs[expIdx + 1];
  const roleTemplate = paragraphs[expIdx + 2];
  const bulletTemplate = paragraphs[expIdx + 3] ?? paragraphs[expIdx + 2];

  const experienceParagraphs: string[] = [];
  for (const exp of content.experiences) {
    experienceParagraphs.push(setParagraphText(companyTemplate, exp.company));
    const roleDates = exp.dates ? `${exp.role}    ${exp.dates}` : exp.role;
    experienceParagraphs.push(setParagraphText(roleTemplate, roleDates));
    for (const bullet of exp.bullets) {
      experienceParagraphs.push(setParagraphText(bulletTemplate, bullet));
    }
  }

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
