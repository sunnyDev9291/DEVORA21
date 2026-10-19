import { finalizeResumeContent } from "@/lib/resume-prompt";
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
  /** One-shot task (e.g. improve one score item) — forwarded; backend owns prompt. */
  task?: string;
  atsFeedback?: AtsScoreResult;
  ruleKeepFeedback?: RuleKeepScoreResult;
  /** Prior draft — FE finalize only (backend builds the AI prompt). */
  previousContent?: GeneratedResumeContent;
  profileName?: string;
}

/**
 * Context carried from prepare → browser stream → finalize.
 * Backend owns the Claude prompt from stored template structure.
 * FE only displays/signals + parses the streamed JSON.
 */
export interface ResumeMergeContext {
  layout: ResumeTemplateLayout;
  fallbackTitle: string;
  skillsSample?: string;
  customPrompt?: string;
  profileName?: string;
  previousContent?: GeneratedResumeContent;
  templateId?: string;
}

export interface ResumeGeneratePrep {
  templateName: string;
  templateId?: string;
  jobTitle: string;
  jobDescription: string;
  /** Always empty in resume mode — backend ignores FE messages and builds the prompt. */
  messages: Array<{ role: "system" | "user"; content: string }>;
  mergeContext: ResumeMergeContext;
  userId?: string;
  task?: string;
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
 * Prepare merge/finalize context only.
 * Do NOT invent Claude system/user prompts or parse DOCX for bullet counts —
 * backend builds the prompt from the stored template structure.
 */
export async function prepareResumeGeneration(
  body: ResumeGenerateRequest
): Promise<ResumeGeneratePrep> {
  // ORIGINAL posting title only — never substitute previousContent.title (AI headline).
  const jobTitle = body.jobTitle?.trim() ?? "";
  const companyName = body.companyName?.trim() ?? "";
  const jobDescription = body.jobDescription?.trim() ?? "";
  const customPrompt = body.customPrompt?.trim() ?? "";
  const previousContent = body.previousContent;
  const templateId = body.templateId?.trim() || undefined;

  if (!jobTitle) throw new Error("Job title is required.");
  if (!companyName) throw new Error("Company name is required.");
  if (!jobTitle && !jobDescription) {
    throw new Error("Job title or job description is required.");
  }

  const hasTemplate = Boolean(
    templateId || body.templateBase64?.trim() || body.templateName?.trim()
  );
  if (!hasTemplate) {
    throw new Error("Upload a resume template in your profile first.");
  }

  const templateName =
    body.templateName?.trim().replace(/\.docx$/i, "") || templateId || "resume";

  const mergeContext: ResumeMergeContext = {
    layout: previousContent?.layout ?? "bullets",
    fallbackTitle: jobTitle,
    customPrompt: customPrompt || undefined,
    profileName: body.profileName?.trim() || undefined,
    previousContent: previousContent || undefined,
    templateId,
  };

  return {
    templateName,
    templateId,
    jobTitle,
    jobDescription,
    messages: [],
    mergeContext,
    userId: body.userId?.trim() || undefined,
    task: body.task?.trim() || undefined,
  };
}

/** Parse AI JSON → structured content (display/finalize only). */
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
