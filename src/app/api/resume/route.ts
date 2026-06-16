import { readFile } from "fs/promises";
import path from "path";
import { completeDeepSeek } from "@/lib/deepseek-stream";
import { parseResumeHeaderFromDocxBuffer } from "@/lib/resume-docx";
import { resolveExperiencesFromDocx } from "@/lib/resume-docx-ai-parse";
import {
  RESUME_SYSTEM_PROMPT,
  buildResumeUserPrompt,
  mergeResumeWithTemplate,
  parseResumeJsonContent,
  RESUME_MAX_TOKENS,
} from "@/lib/resume-prompt";
import { TEMPLATES_DIR } from "@/lib/templates-dir";

export const runtime = "nodejs";

interface ResumeRequest {
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  customPrompt?: string;
  templateName?: string;
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

  const templateInput = body.templateName?.trim();
  if (!templateInput) {
    return Response.json({ error: "templateName is required — select a template first." }, { status: 400 });
  }

  try {
    const safeName = path.basename(
      templateInput.endsWith(".docx") ? templateInput : `${templateInput}.docx`
    );
    const filePath = path.join(TEMPLATES_DIR, safeName);
    const templateName = safeName.replace(/\.docx$/i, "");

    if (!path.resolve(filePath).startsWith(path.resolve(TEMPLATES_DIR))) {
      return Response.json({ error: "Invalid template." }, { status: 400 });
    }

    const templateBuffer = await readFile(filePath);
    const existingExperiences = await resolveExperiencesFromDocx(templateBuffer);
    const header = parseResumeHeaderFromDocxBuffer(templateBuffer);

    const userPrompt = buildResumeUserPrompt({
      jobTitle,
      companyName,
      jobDescription,
      customPrompt,
      headerTitle: header.title,
      existingExperiences,
    });

    const aiRaw = await completeDeepSeek(
      [
        { role: "system", content: RESUME_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      RESUME_MAX_TOKENS,
      { jsonObject: true }
    );

    const parsed = parseResumeJsonContent(aiRaw);
    const content = mergeResumeWithTemplate(parsed, existingExperiences, header.title);

    if (content.experiences.length === 0) {
      throw new Error("No experience sections found in template.");
    }

    return Response.json({ content, templateName });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate resume content.";
    return Response.json({ error: message }, { status: 500 });
  }
}
