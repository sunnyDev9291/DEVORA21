import { completeDeepSeek } from "@/lib/deepseek-stream";

import { parseResumeHeaderFromDocxBuffer } from "@/lib/resume-docx";

import { getCachedTemplateParse } from "@/lib/resume-template-cache";

import { resolveTemplateBuffer } from "@/lib/resume-template-resolve";

import {
  buildResumeSystemPrompt,
  buildResumeUserPrompt,
  finalizeResumeContent,
  RESUME_MAX_TOKENS,
} from "@/lib/resume-prompt";
import { ensureResumeContentFileName } from "@/lib/resume-filename";
import { applyTemplateSkillsStyle } from "@/lib/resume-generate-prep";



export const runtime = "nodejs";



interface ResumeRequest {

  jobTitle?: string;

  companyName?: string;

  jobDescription?: string;

  customPrompt?: string;

  templateName?: string;

  templateBase64?: string;

  profileName?: string;

}



export async function POST(req: Request) {

  let body: ResumeRequest;

  try {

    body = await req.json();

  } catch {

    return Response.json({ error: "Invalid JSON body." }, { status: 400 });

  }



  const jobTitle = body.jobTitle?.trim() ?? "";

  const companyName = body.companyName?.trim() ?? "";

  const jobDescription = body.jobDescription?.trim() ?? "";

  const customPrompt = body.customPrompt?.trim() ?? "";



  if (!jobTitle) {

    return Response.json({ error: "Job title is required." }, { status: 400 });

  }



  if (!companyName) {

    return Response.json({ error: "Company name is required." }, { status: 400 });

  }



  const hasTemplate = Boolean(body.templateBase64?.trim() || body.templateName?.trim());

  if (!hasTemplate) {

    return Response.json({ error: "templateName or templateBase64 is required." }, { status: 400 });

  }



  try {

    const { buffer: templateBuffer, templateName } = await resolveTemplateBuffer({

      templateName: body.templateName,

      templateBase64: body.templateBase64,

    });



    const { experiences: existingExperiences, layout: templateLayout, skillsSample } =
      await getCachedTemplateParse(templateName, templateBuffer);

    const header = parseResumeHeaderFromDocxBuffer(templateBuffer);

    const userPrompt = buildResumeUserPrompt({
      jobTitle,
      companyName,
      jobDescription,
      existingExperiences,
      templateLayout,
      templateSkillsSample: skillsSample,
    });

    const aiRaw = await completeDeepSeek(
      [
        { role: "system", content: buildResumeSystemPrompt(false, templateLayout) },
        { role: "user", content: userPrompt },
      ],
      RESUME_MAX_TOKENS,
      { jsonObject: true }
    );

    const content = ensureResumeContentFileName(
      applyTemplateSkillsStyle(
        finalizeResumeContent(aiRaw, existingExperiences, header.title, templateLayout),
        skillsSample,
        templateLayout
      ),
      { templateName, customPrompt, profileName: body.profileName?.trim() }
    );



    if (content.experiences.length === 0) {

      throw new Error("No experience sections found in template.");

    }



    return Response.json({ content, templateName });

  } catch (err) {

    const message = err instanceof Error ? err.message : "Failed to generate resume content.";

    return Response.json({ error: message }, { status: 500 });

  }

}


