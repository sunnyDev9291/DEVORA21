import { readFile } from "fs/promises";
import path from "path";
import { parseResumeHeaderFromDocxBuffer } from "@/lib/resume-docx";
import { resolveExperiencesFromDocx } from "@/lib/resume-docx-ai-parse";
import {
  RESUME_SYSTEM_PROMPT,
  buildResumeUserPrompt,
  mergeResumeWithTemplate,
  parseResumeJsonContent,
} from "@/lib/resume-prompt";
import type { GeneratedResumeContent, ResumeExperience } from "@/lib/resume-types";
import { TEMPLATES_DIR } from "@/lib/templates-dir";

export interface ResumeGenerateRequest {
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  customPrompt?: string;
  templateName?: string;
}

export interface ResumeGeneratePrep {
  templateName: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  existingExperiences: ResumeExperience[];
  headerTitle: string;
}

export interface ResumeMergeContext {
  existingExperiences: ResumeExperience[];
  headerTitle: string;
}

export type ResumeJobRecord =
  | {
      status: "pending";
      templateName: string;
      mergeContext: ResumeMergeContext;
      messages: Array<{ role: "system" | "user"; content: string }>;
      createdAt: number;
    }
  | {
      status: "done";
      templateName: string;
      mergeContext: ResumeMergeContext;
      text: string;
      createdAt: number;
    }
  | {
      status: "error";
      templateName: string;
      mergeContext: ResumeMergeContext;
      message: string;
      createdAt: number;
    };

export async function prepareResumeGeneration(
  body: ResumeGenerateRequest
): Promise<ResumeGeneratePrep> {
  const jobTitle = body.jobTitle?.trim() ?? "";
  const companyName = body.companyName?.trim() ?? "";
  const jobDescription = body.jobDescription?.trim() ?? "";
  const customPrompt = body.customPrompt?.trim() ?? "";

  if (!jobTitle) throw new Error("Job title is required.");
  if (!companyName) throw new Error("Company name is required.");

  const templateInput = body.templateName?.trim();
  if (!templateInput) {
    throw new Error("templateName is required — select a template first.");
  }

  const safeName = path.basename(
    templateInput.endsWith(".docx") ? templateInput : `${templateInput}.docx`
  );
  const filePath = path.join(TEMPLATES_DIR, safeName);
  const templateName = safeName.replace(/\.docx$/i, "");

  if (!path.resolve(filePath).startsWith(path.resolve(TEMPLATES_DIR))) {
    throw new Error("Invalid template.");
  }

  const templateBuffer = await readFile(filePath);
  const existingExperiences = await resolveExperiencesFromDocx(templateBuffer);
  const header = parseResumeHeaderFromDocxBuffer(templateBuffer);

  if (existingExperiences.length === 0) {
    throw new Error("No experience sections found in template.");
  }

  const userPrompt = buildResumeUserPrompt({
    jobTitle,
    companyName,
    jobDescription,
    customPrompt,
    headerTitle: header.title,
    existingExperiences,
  });

  return {
    templateName,
    messages: [
      { role: "system", content: RESUME_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    existingExperiences,
    headerTitle: header.title,
  };
}

export function finalizeResumeContent(
  modelText: string,
  mergeContext: ResumeMergeContext
): GeneratedResumeContent {
  const parsed = parseResumeJsonContent(modelText);
  return mergeResumeWithTemplate(
    parsed,
    mergeContext.existingExperiences,
    mergeContext.headerTitle
  );
}
