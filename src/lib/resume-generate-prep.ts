import { readFile } from "fs/promises";
import path from "path";
import { parseResumeHeaderFromDocxBuffer } from "@/lib/resume-docx";
import { getCachedTemplateExperiences } from "@/lib/resume-template-cache";
import {
  buildResumeSystemPrompt,
  buildResumeUserPrompt,
  mergeResumeWithTemplate,
  parseResumeJsonContent,
} from "@/lib/resume-prompt";
import type { AtsScoreResult, GeneratedResumeContent, HumanToneScoreResult, ResumeExperience } from "@/lib/resume-types";
import { TEMPLATES_DIR } from "@/lib/templates-dir";

export interface ResumeGenerateRequest {
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  customPrompt?: string;
  templateName?: string;
  /** Prior ATS evaluation — used when regenerating to target a higher score. */
  atsFeedback?: AtsScoreResult;
  /** Prior human tone evaluation — co-target during regenerate. */
  humanToneFeedback?: HumanToneScoreResult;
  /** Draft content from the previous generation — paired with feedback fields. */
  previousContent?: GeneratedResumeContent;
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
      expiresAt: number;
      dedupeKey: string;
      triggerStartedAt?: number;
    }
  | {
      status: "done";
      templateName: string;
      mergeContext: ResumeMergeContext;
      text: string;
      createdAt: number;
      expiresAt: number;
      dedupeKey: string;
    }
  | {
      status: "error";
      templateName: string;
      mergeContext: ResumeMergeContext;
      message: string;
      createdAt: number;
      expiresAt: number;
      dedupeKey: string;
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
  const existingExperiences = await getCachedTemplateExperiences(templateName, templateBuffer);
  const header = parseResumeHeaderFromDocxBuffer(templateBuffer);

  if (existingExperiences.length === 0) {
    throw new Error("No experience sections found in template.");
  }

  const isRegenerate = Boolean(body.atsFeedback && body.previousContent);

  const userPrompt = buildResumeUserPrompt({
    jobTitle,
    companyName,
    jobDescription,
    customPrompt,
    headerTitle: header.title,
    existingExperiences,
    atsFeedback: body.atsFeedback,
    humanToneFeedback: body.humanToneFeedback,
    previousContent: body.previousContent,
  });

  return {
    templateName,
    messages: [
      { role: "system", content: buildResumeSystemPrompt(isRegenerate) },
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
