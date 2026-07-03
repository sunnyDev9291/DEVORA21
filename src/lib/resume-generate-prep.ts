import { parseResumeHeaderFromDocxBuffer } from "@/lib/resume-docx";
import { getCachedJobKeywords } from "@/lib/resume-keywords-cache";
import { getCachedTemplateParse } from "@/lib/resume-template-cache";
import { resolveTemplateBuffer } from "@/lib/resume-template-resolve";
import {
  buildResumeSystemPrompt,
  buildResumeUserPrompt,
  finalizeResumeContent,
} from "@/lib/resume-prompt";
import { ensureResumeContentFileName } from "@/lib/resume-filename";
import { formatSkillsWithTemplateStyle } from "@/lib/resume-skills-style";
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
  /** Profile display name — used when AI omits fileName. */
  profileName?: string;
}

export interface ResumeGeneratePrep {
  templateName: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  existingExperiences: ResumeExperience[];
  templateLayout: ResumeTemplateLayout;
  headerTitle: string;
  customPrompt: string;
  profileName?: string;
  skillsSample: string;
  regenerateBaseline?: GeneratedResumeContent;
}

export interface ResumeMergeContext {
  existingExperiences: ResumeExperience[];
  templateLayout: ResumeTemplateLayout;
  headerTitle: string;
  customPrompt?: string;
  profileName?: string;
  skillsSample?: string;
  /** Previous user draft — used during regenerate to preserve unchanged fields. */
  regenerateBaseline?: GeneratedResumeContent;
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

  const { experiences: existingExperiences, layout: templateLayout, skillsSample } =
    await getCachedTemplateParse(templateName, templateBuffer);
  const header = parseResumeHeaderFromDocxBuffer(templateBuffer);

  if (existingExperiences.length === 0) {
    throw new Error("No experience sections found in template.");
  }

  const isRegenerate = Boolean(body.previousContent);

  let priorityKeywords: string[] | undefined;
  if (!isRegenerate && jobDescription) {
    const { keywords } = await getCachedJobKeywords(jobTitle, companyName, jobDescription);
    priorityKeywords = keywords.mustHave.slice(0, 18);
  }

  const userPrompt = buildResumeUserPrompt({
    jobTitle,
    jobDescription,
    customPrompt,
    existingExperiences,
    templateLayout,
    previousContent: isRegenerate ? body.previousContent : undefined,
    atsFeedback: isRegenerate ? body.atsFeedback : undefined,
    ruleKeepFeedback: isRegenerate ? body.ruleKeepFeedback : undefined,
    priorityKeywords,
    templateSkillsSample: skillsSample,
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
    customPrompt,
    profileName: body.profileName?.trim() || undefined,
    skillsSample,
    regenerateBaseline: isRegenerate ? body.previousContent : undefined,
  };
}

export function finalizeResumeContentFromModel(
  modelText: string,
  mergeContext: ResumeMergeContext,
  templateName: string
): GeneratedResumeContent {
  const content = finalizeResumeContent(
    modelText,
    mergeContext.existingExperiences,
    mergeContext.headerTitle,
    mergeContext.templateLayout,
    mergeContext.regenerateBaseline
  );
  const styled = applyTemplateSkillsStyle(content, mergeContext.skillsSample);
  return ensureResumeContentFileName(styled, {
    templateName,
    customPrompt: mergeContext.customPrompt,
    profileName: mergeContext.profileName,
  });
}

function applyTemplateSkillsStyle(
  content: GeneratedResumeContent,
  skillsSample?: string
): GeneratedResumeContent {
  if (!skillsSample?.trim()) return content;
  return {
    ...content,
    skills: formatSkillsWithTemplateStyle(content.skills, skillsSample),
  };
}

export { applyTemplateSkillsStyle };