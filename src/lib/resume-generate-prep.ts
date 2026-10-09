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
  /** Backend-stored style template id (preferred). */
  templateId?: string;
  userId?: string;
  /** One-shot task (e.g. improve one score item). */
  task?: string;
  atsFeedback?: AtsScoreResult;
  ruleKeepFeedback?: RuleKeepScoreResult;
  /** Prior draft — only used for improve/regenerate. */
  previousContent?: GeneratedResumeContent;
  profileName?: string;
}

/**
 * Context carried from prepare → browser stream → finalize.
 * Style-only: no DOCX-parsed employers. Content comes from AI JSON (+ optional previous draft).
 */
export interface ResumeMergeContext {
  layout: ResumeTemplateLayout;
  fallbackTitle: string;
  skillsSample?: string;
  customPrompt?: string;
  profileName?: string;
  previousContent?: GeneratedResumeContent;
}

export interface ResumeGeneratePrep {
  templateName: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  mergeContext: ResumeMergeContext;
  userId?: string;
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
 * Build prompts for Claude. Template DOCX is styles/slots only —
 * never require SUMMARY / SKILLS / EXPERIENCE text headers.
 */
export async function prepareResumeGeneration(
  body: ResumeGenerateRequest
): Promise<ResumeGeneratePrep> {
  const jobTitle = body.jobTitle?.trim() ?? "";
  const companyName = body.companyName?.trim() ?? "";
  const jobDescription = body.jobDescription?.trim() ?? "";
  const customPrompt = body.customPrompt?.trim() ?? "";
  const previousContent = body.previousContent;
  const isRegenerate = Boolean(previousContent);

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
  let layout: ResumeTemplateLayout = previousContent?.layout ?? "bullets";
  let skillsSample = "";
  let fallbackTitle = jobTitle;

  // Optional soft hints from local DOCX bytes (skills sample / layout). Never required.
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
        if (!previousContent?.layout) layout = parsed.layout ?? "bullets";
        skillsSample = parsed.skillsSample ?? "";
      } catch {
        // Style templates without text section headers are expected.
      }

      try {
        const { parseResumeHeaderFromDocxBuffer } = await import("@/lib/resume-docx");
        const header = parseResumeHeaderFromDocxBuffer(resolved.buffer);
        if (header.title?.trim()) fallbackTitle = header.title.trim();
      } catch {
        // Header title optional.
      }
    } catch {
      // templateId-only is fine when bytes are not on the FE.
    }
  }

  const mergeContext: ResumeMergeContext = {
    layout,
    fallbackTitle,
    skillsSample: skillsSample || undefined,
    customPrompt: customPrompt || undefined,
    profileName: body.profileName?.trim() || undefined,
    previousContent: isRegenerate ? previousContent : undefined,
  };

  return {
    templateName,
    messages: [
      { role: "system", content: buildResumeSystemPrompt(isRegenerate, layout) },
      {
        role: "user",
        content: buildResumeUserPrompt({
          jobTitle,
          companyName,
          jobDescription,
          templateLayout: layout,
          previousContent: isRegenerate ? previousContent : undefined,
          templateSkillsSample: skillsSample,
          task: body.task?.trim() || undefined,
          writingInstructions: customPrompt,
        }),
      },
    ],
    mergeContext,
    userId: body.userId?.trim() || undefined,
  };
}

/** Parse AI JSON → structured content (style-only merge). */
export function finalizeResumeContentFromModel(
  modelText: string,
  mergeContext: ResumeMergeContext,
  templateName: string
): GeneratedResumeContent {
  const content = finalizeResumeContent(modelText, {
    fallbackTitle: mergeContext.fallbackTitle,
    layout: mergeContext.layout,
    previousContent: mergeContext.previousContent,
    skillsSample: mergeContext.skillsSample,
  });
  return ensureResumeContentFileName(content, {
    templateName,
    customPrompt: mergeContext.customPrompt,
    profileName: mergeContext.profileName,
  });
}

export function applyTemplateSkillsStyle(
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
