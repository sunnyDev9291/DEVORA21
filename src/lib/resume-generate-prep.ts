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
  /** Backend-stored style template id (preferred; DOCX body text is not required). */
  templateId?: string;
  /** Logged-in user id — forwarded to the AI backend for profile prompt. */
  userId?: string;
  /** Extra task for this click only (e.g. improve one score item). Not the profile prompt. */
  task?: string;
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
  userId?: string;
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

/**
 * Style-only templates: DOCX section headers (SUMMARY / SKILLS / EXPERIENCE / Work History)
 * are visual only. Content comes from profile writing instructions + AI JSON.
 * Never fail generate because a text header is missing in the Word file.
 */
export async function prepareResumeGeneration(
  body: ResumeGenerateRequest
): Promise<ResumeGeneratePrep> {
  const jobTitle = body.jobTitle?.trim() ?? "";
  const companyName = body.companyName?.trim() ?? "";
  const jobDescription = body.jobDescription?.trim() ?? "";
  const customPrompt = body.customPrompt?.trim() ?? "";

  if (!jobTitle) throw new Error("Job title is required.");
  if (!companyName) throw new Error("Company name is required.");

  const hasTemplate = Boolean(
    body.templateBase64?.trim() || body.templateName?.trim() || body.templateId?.trim()
  );
  if (!hasTemplate) {
    throw new Error("Upload a resume template in your profile first.");
  }

  let templateName =
    body.templateName?.trim().replace(/\.docx$/i, "") ||
    body.templateId?.trim() ||
    "resume";
  let existingExperiences: ResumeExperience[] = [];
  let templateLayout: ResumeTemplateLayout = "bullets";
  let skillsSample = "";
  let headerTitle = jobTitle;

  // Optional soft parse for skills sample / layout hint only — never require text headers.
  if (body.templateBase64?.trim() || body.templateName?.trim()) {
    try {
      const resolved = await resolveTemplateBuffer({
        templateName: body.templateName,
        templateBase64: body.templateBase64,
      });
      templateName = resolved.templateName;

      try {
        const { getCachedTemplateParse } = await import("@/lib/resume-template-cache");
        const parsed = await getCachedTemplateParse(templateName, resolved.buffer);
        templateLayout = parsed.layout ?? "bullets";
        skillsSample = parsed.skillsSample ?? "";
        // Style mode: do NOT freeze employers from DOCX parse; ignore experiences for merge locks.
      } catch {
        // Styled templates without SUMMARY/EXPERIENCE text headers are expected.
      }

      try {
        const { parseResumeHeaderFromDocxBuffer } = await import("@/lib/resume-docx");
        const header = parseResumeHeaderFromDocxBuffer(resolved.buffer);
        if (header.title?.trim()) headerTitle = header.title.trim();
      } catch {
        // Header title optional for style-only templates.
      }
    } catch {
      // Missing local template bytes is OK when templateId alone was provided.
    }
  }

  const isRegenerate = Boolean(body.previousContent);
  if (isRegenerate && body.previousContent?.experiences?.length) {
    existingExperiences = body.previousContent.experiences;
  }

  const userPrompt = buildResumeUserPrompt({
    jobTitle,
    companyName,
    jobDescription,
    existingExperiences,
    templateLayout,
    previousContent: isRegenerate ? body.previousContent : undefined,
    templateSkillsSample: skillsSample,
    task: body.task?.trim() || undefined,
    writingInstructions: customPrompt,
  });

  return {
    templateName,
    messages: [
      { role: "system", content: buildResumeSystemPrompt(isRegenerate, templateLayout) },
      { role: "user", content: userPrompt },
    ],
    existingExperiences,
    templateLayout,
    headerTitle,
    customPrompt,
    profileName: body.profileName?.trim() || undefined,
    skillsSample,
    regenerateBaseline: isRegenerate ? body.previousContent : undefined,
    userId: body.userId?.trim() || undefined,
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
  const styled = applyTemplateSkillsStyle(
    content,
    mergeContext.skillsSample,
    mergeContext.templateLayout
  );
  return ensureResumeContentFileName(styled, {
    templateName,
    customPrompt: mergeContext.customPrompt,
    profileName: mergeContext.profileName,
  });
}

function applyTemplateSkillsStyle(
  content: GeneratedResumeContent,
  skillsSample?: string,
  layout: ResumeTemplateLayout = content.layout ?? "bullets"
): GeneratedResumeContent {
  if (!skillsSample?.trim()) return content;
  return {
    ...content,
    skills: formatSkillsWithTemplateStyle(content.skills, skillsSample, layout),
  };
}

export { applyTemplateSkillsStyle };
