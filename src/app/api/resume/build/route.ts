import { applyContentToDocx } from "@/lib/resume-docx";

import { applyResumeContentPostProcess } from "@/lib/resume-content-postprocess";
import { isProjectLayout } from "@/lib/resume-experience-utils";

import { buildExpectedResumeFileName } from "@/lib/resume-filename";

import { getCachedTemplateParse } from "@/lib/resume-template-cache";

import { resolveTemplateBuffer } from "@/lib/resume-template-resolve";
import type { GeneratedResumeContent } from "@/lib/resume-types";



export const runtime = "nodejs";



interface BuildRequest {

  templateName?: string;

  templateBase64?: string;

  customPrompt?: string;

  resumeFileBaseName?: string;

  profileName?: string;

  content?: GeneratedResumeContent;

}



function validateContent(
  content: GeneratedResumeContent,
  layout: GeneratedResumeContent["layout"] = "bullets"
): GeneratedResumeContent {
  if (!content.title?.trim() || !content.summary?.trim() || !content.skills?.trim()) {
    throw new Error("Resume title, summary, and skills are required.");
  }
  if (!Array.isArray(content.experiences) || content.experiences.length === 0) {
    throw new Error("At least one experience entry is required.");
  }

  const projectMode = isProjectLayout(layout ?? content.layout);

  return {
    title: content.title.trim(),
    summary: content.summary.trim(),
    skills: content.skills.trim(),
    ...(content.fileName?.trim()
      ? { fileName: content.fileName.trim() }
      : {}),
    layout: projectMode ? "projects" : "bullets",
    experiences: content.experiences.map((e) => {
      if (projectMode) {
        const projects = (e.projects ?? []).map((p) => ({
          name: String(p.name ?? "").trim(),
          businessChallenge: String(p.businessChallenge ?? "").trim(),
          assignedResponsibility: String(p.assignedResponsibility ?? "").trim(),
          action: String(p.action ?? "").trim(),
          result: String(p.result ?? "").trim(),
        }));
        return {
          company: String(e.company ?? "").trim(),
          role: String(e.role ?? "").trim(),
          dates: String(e.dates ?? "").trim(),
          bullets: [],
          projects,
        };
      }
      return {
        company: String(e.company ?? "").trim(),
        role: String(e.role ?? "").trim(),
        dates: String(e.dates ?? "").trim(),
        bullets: (e.bullets ?? []).map((b) => String(b).trim()).filter(Boolean),
      };
    }),
  };
}



export async function POST(req: Request) {

  let body: BuildRequest;

  try {

    body = await req.json();

  } catch {

    return Response.json({ error: "Invalid JSON body." }, { status: 400 });

  }



  const hasTemplate = Boolean(body.templateBase64?.trim() || body.templateName?.trim());

  if (!hasTemplate) {

    return Response.json({ error: "templateName or templateBase64 is required." }, { status: 400 });

  }

  if (!body.content) {

    return Response.json({ error: "content is required." }, { status: 400 });

  }



  try {

    const { buffer: templateBuffer, templateName } = await resolveTemplateBuffer({
      templateName: body.templateName,
      templateBase64: body.templateBase64,
    });

    const { experiences: templateExperiences, layout: templateLayout } =
      await getCachedTemplateParse(templateName, templateBuffer);
    const content = validateContent(body.content, templateLayout);
    const processedContent = applyResumeContentPostProcess(
      content,
      templateExperiences,
      templateLayout
    );

    const updatedBuffer = applyContentToDocx(templateBuffer, processedContent);

    const docxBase64 = updatedBuffer.toString("base64");

    const customPrompt = body.customPrompt?.trim() ?? "";

    const fileName = buildExpectedResumeFileName(
      templateName,
      processedContent,
      customPrompt,
      body.resumeFileBaseName,
      body.profileName
    );



    return Response.json({ templateName, docxBase64, fileName });

  } catch (err) {

    const message = err instanceof Error ? err.message : "Failed to build resume.";

    return Response.json({ error: message }, { status: 500 });

  }

}


