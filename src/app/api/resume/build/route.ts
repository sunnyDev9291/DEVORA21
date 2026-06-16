import { readFile } from "fs/promises";
import path from "path";
import { applyContentToDocx } from "@/lib/resume-docx";
import { buildExpectedResumeFileName } from "@/lib/resume-filename";
import type { GeneratedResumeContent } from "@/lib/resume-types";
import { TEMPLATES_DIR } from "@/lib/templates-dir";

export const runtime = "nodejs";

interface BuildRequest {
  templateName?: string;
  jobTitle?: string;
  content?: GeneratedResumeContent;
}

function validateContent(content: GeneratedResumeContent): GeneratedResumeContent {
  if (!content.title?.trim() || !content.summary?.trim() || !content.skills?.trim()) {
    throw new Error("Resume title, summary, and skills are required.");
  }
  if (!Array.isArray(content.experiences) || content.experiences.length === 0) {
    throw new Error("At least one experience entry is required.");
  }

  return {
    title: content.title.trim(),
    summary: content.summary.trim(),
    skills: content.skills.trim(),
    experiences: content.experiences.map((e) => ({
      company: String(e.company ?? "").trim(),
      role: String(e.role ?? "").trim(),
      dates: String(e.dates ?? "").trim(),
      bullets: (e.bullets ?? []).map((b) => String(b).trim()).filter(Boolean),
    })),
  };
}

export async function POST(req: Request) {
  let body: BuildRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const templateInput = body.templateName?.trim();
  if (!templateInput) {
    return Response.json({ error: "templateName is required." }, { status: 400 });
  }
  if (!body.content) {
    return Response.json({ error: "content is required." }, { status: 400 });
  }

  try {
    const content = validateContent(body.content);

    const safeName = path.basename(
      templateInput.endsWith(".docx") ? templateInput : `${templateInput}.docx`
    );
    const filePath = path.join(TEMPLATES_DIR, safeName);
    const templateName = safeName.replace(/\.docx$/i, "");

    if (!path.resolve(filePath).startsWith(path.resolve(TEMPLATES_DIR))) {
      return Response.json({ error: "Invalid template." }, { status: 400 });
    }

    const templateBuffer = await readFile(filePath);
    const updatedBuffer = applyContentToDocx(templateBuffer, content);
    const docxBase64 = updatedBuffer.toString("base64");
    const jobTitle = body.jobTitle?.trim() ?? "";
    const fileName = buildExpectedResumeFileName(templateName, jobTitle, content);

    return Response.json({ templateName, docxBase64, fileName });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build resume.";
    return Response.json({ error: message }, { status: 500 });
  }
}
