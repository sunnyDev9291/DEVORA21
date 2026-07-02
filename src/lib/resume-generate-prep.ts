import { parseResumeHeaderFromDocxBuffer } from "@/lib/resume-docx";
import { getCachedTemplateParse } from "@/lib/resume-template-cache";
import { resolveTemplateBuffer } from "@/lib/resume-template-resolve";
import {
  buildResumeSystemPrompt,
  buildResumeUserPrompt,
  finalizeResumeContent,
} from "@/lib/resume-prompt";
import type {
  AtsScoreResult,
  GeneratedResumeContent,
  ResumeExperience,
  ResumeTemplateLayout,
  RuleKeepScoreResult,
} from "@/lib/resume-types";

export interface ResumeGenerateRequest {
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  customPrompt?: string;
  templateName?: string;
  templateBase64?: string;
  /** Prior ATS evaluation — used when regenerating to target a higher score. */
  atsFeedback?: AtsScoreResult;
  /** Prior rule keep evaluation — co-target during regenerate. */
  ruleKeepFeedback?: RuleKeepScoreResult;
  /** Draft content from the previous generation — paired with feedback fields. */
  previousContent?: GeneratedResumeContent;
}

export interface ResumeGeneratePrep {
  templateName: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  existingExperiences: ResumeExperience[];
  templateLayout: ResumeTemplateLayout;
  headerTitle: string;
}

export interface ResumeMergeContext {
  existingExperiences: ResumeExperience[];
  templateLayout: ResumeTemplateLayout;
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

  const hasTemplate = Boolean(body.templateBase64?.trim() || body.templateName?.trim());
  if (!hasTemplate) {
    throw new Error("Upload a resume template in your profile first.");
  }

  const { buffer: templateBuffer, templateName } = await resolveTemplateBuffer({
    templateName: body.templateName,
    templateBase64: body.templateBase64,
  });

  const { experiences: existingExperiences, layout: templateLayout } =
    await getCachedTemplateParse(templateName, templateBuffer);
  const header = parseResumeHeaderFromDocxBuffer(templateBuffer);

  if (existingExperiences.length === 0) {
    throw new Error("No experience sections found in template.");
  }

  const isRegenerate = Boolean(body.previousContent);

  const userPrompt = buildResumeUserPrompt({
    jobTitle,
    jobDescription,
    customPrompt,
    existingExperiences,
    templateLayout,
    previousContent: isRegenerate ? body.previousContent : undefined,
  });

  return {
    templateName,
    messages: [
      { role: "system", content: buildResumeSystemPrompt(isRegenerate, templateLayout) },
      { role: "user", content: userPrompt },
    ],
    existingExperiences,
    templateLayout,
    headerTitle: header.title,
  };
}

export function finalizeResumeContentFromModel(
  modelText: string,
  mergeContext: ResumeMergeContext
): GeneratedResumeContent {
  return finalizeResumeContent(
    modelText,
    mergeContext.existingExperiences,
    mergeContext.headerTitle,
    mergeContext.templateLayout
  );
}