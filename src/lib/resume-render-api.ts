import { API_BASE_URL } from "@/lib/api-base-url";
import { apiAuthFetch } from "@/lib/api-auth";
import { ApiError, getApiErrorMessage } from "@/lib/auth-api";
import {
  RESUME_BUILDER_ACCESS_MESSAGE,
  isResumeBuilderAccessDenied,
  resumeBuilderAccessDeniedMessage,
} from "@/lib/resume-access";
import { fetchSavedResumeFile } from "@/lib/saved-resumes-api";
import type { GeneratedResumeContent } from "@/lib/resume-types";

/**
 * Backend-owned render pipeline.
 * Frontend never builds DOCX/PDF locally — it only sends content + template id.
 *
 * POST /resume/render
 * → load stored template → fill DOCX → save → PDF → save → return ids/metadata
 */

/** User-facing copy when backend rejects a template missing Word style slots. */
export const MISSING_STYLED_SLOTS_MESSAGE =
  "This resume template is missing required Word styles (Name, summary, skill_cat/skill_item, company_*, exp_section).";

export function isMissingStyledSlotsError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status !== 422 && error.status !== 400) return false;
  const message = `${error.message} ${typeof error.data?.message === "string" ? error.data.message : ""}`.toLowerCase();
  return (
    /style|slot|skill_cat|skill_item|exp_section|company_role|company_period|header_name|resume_title/.test(
      message
    ) || /missing.*(style|slot|name|summary)/.test(message)
  );
}

/** Prefer styled-slots / access messages over raw backend text. */
export function resumeRenderErrorMessage(error: unknown): string {
  if (isMissingStyledSlotsError(error)) return MISSING_STYLED_SLOTS_MESSAGE;
  if (isResumeBuilderAccessDenied(error)) return RESUME_BUILDER_ACCESS_MESSAGE;
  if (error instanceof ApiError && error.status === 403) {
    return resumeBuilderAccessDeniedMessage(error);
  }
  return getApiErrorMessage(error, "Failed to render resume.");
}

/** Shape content for POST /resume/render (skills string + experience fields backend maps to styles). */
export function toResumeRenderContent(content: GeneratedResumeContent): Record<string, unknown> {
  const skills =
    typeof content.skills === "string"
      ? content.skills
      : Array.isArray(content.skills)
        ? (content.skills as string[]).join("\n")
        : String(content.skills ?? "");

  return {
    title: content.title ?? "",
    summary: content.summary ?? "",
    skills,
    ...(content.fileName?.trim() ? { fileName: content.fileName.trim() } : {}),
    ...(content.education
      ? {
          education: {
            ...(content.education.degree?.trim()
              ? { degree: content.education.degree.trim() }
              : {}),
            ...(content.education.university?.trim()
              ? { university: content.education.university.trim() }
              : {}),
            ...(content.education.period?.trim()
              ? { period: content.education.period.trim() }
              : {}),
          },
        }
      : {}),
    experiences: (content.experiences ?? []).map((exp) => ({
      company: exp.company ?? "",
      role: exp.role ?? "",
      dates: exp.dates ?? "",
      ...(exp.location?.trim() ? { location: exp.location.trim() } : {}),
      bullets: Array.isArray(exp.bullets) ? exp.bullets : [],
      ...(exp.projects?.length ? { projects: exp.projects } : {}),
    })),
  };
}

export type ResumeRenderRequest = {
  /** Preferred: stored template id from upload/profile. */
  templateId?: string;
  /** Transitional fallback while backends still accept inline template bytes. */
  templateBase64?: string;
  templateFileName?: string;
  content: GeneratedResumeContent;
  jobTitle: string;
  companyName: string;
  jobDescription?: string;
  customPrompt?: string;
  resumeFileBaseName?: string;
  profileName?: string;
  /** Re-render an existing resume draft (optional). */
  resumeId?: string;
};

export type ResumeRenderResponse = {
  resumeId: string;
  archiveId: string;
  templateId?: string;
  fileName: string;
  pdfFileName: string;
  status: "done" | "rendering" | string;
  /** Optional convenience — FE still loads PDF via archive endpoints for preview/download. */
  pdfBase64?: string;
  docxBase64?: string;
};

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

function errorMessage(data: Record<string, unknown>, fallback: string): string {
  if (typeof data.message === "string" && data.message.trim()) return data.message.trim();
  if (typeof data.error === "string" && data.error.trim()) return data.error.trim();
  return fallback;
}

function throwAuthAware(res: Response, data: Record<string, unknown>): never {
  const message = errorMessage(data, `Render failed (${res.status}).`);
  if (res.status === 401) {
    throw new ApiError("Authentication required. Sign in or connect a dv21_ API key.", 401, {
      message,
    });
  }
  if (res.status === 403) {
    const err = new ApiError(message, 403, { message });
    if (isResumeBuilderAccessDenied(err)) {
      throw new ApiError(RESUME_BUILDER_ACCESS_MESSAGE, 403, { message });
    }
    throw new ApiError(resumeBuilderAccessDeniedMessage(err), 403, { message });
  }
  if (res.status === 422) {
    const err = new ApiError(message, 422, { message });
    if (isMissingStyledSlotsError(err)) {
      throw new ApiError(MISSING_STYLED_SLOTS_MESSAGE, 422, { message });
    }
    throw err;
  }
  throw new ApiError(message, res.status, { message });
}

function pickString(data: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeRenderResponse(data: Record<string, unknown>): ResumeRenderResponse {
  const archiveId =
    pickString(data, "archiveId", "archive_id", "id") ||
    pickString((data.result as Record<string, unknown>) ?? {}, "archiveId", "id");
  const resumeId =
    pickString(data, "resumeId", "resume_id") || archiveId;
  const fileName =
    pickString(data, "fileName", "resumeFileName", "resume_file_name", "docxFileName") ||
    "resume.docx";
  const pdfFileName =
    pickString(data, "pdfFileName", "pdf_file_name") ||
    fileName.replace(/\.docx$/i, ".pdf");

  if (!archiveId) {
    throw new ApiError("Backend render did not return an archive/resume id.", 502);
  }

  return {
    resumeId,
    archiveId,
    templateId: pickString(data, "templateId", "template_id") || undefined,
    fileName: fileName.endsWith(".docx") ? fileName : `${fileName}.docx`,
    pdfFileName,
    status: pickString(data, "status") || "done",
    pdfBase64: pickString(data, "pdfBase64", "pdf_base64") || undefined,
    docxBase64: pickString(data, "docxBase64", "docx_base64") || undefined,
  };
}

/** Authoritative backend render: template + content → stored DOCX + PDF. */
export async function renderResumeOnBackend(
  input: ResumeRenderRequest
): Promise<ResumeRenderResponse> {
  const templateId = input.templateId?.trim();
  const templateBase64 = input.templateBase64?.trim();
  if (!templateId && !templateBase64) {
    throw new ApiError("templateId (or transitional templateBase64) is required to render.", 400);
  }
  if (!input.content) {
    throw new ApiError("Resume content is required to render.", 400);
  }
  if (!input.jobTitle?.trim() || !input.companyName?.trim()) {
    throw new ApiError("Job title and company name are required to render.", 400);
  }

  const res = await apiAuthFetch(`${API_BASE_URL}/resume/render`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      templateId: templateId || undefined,
      templateBase64: templateId ? undefined : templateBase64,
      templateFileName: input.templateFileName?.trim() || undefined,
      templateName: input.templateFileName?.trim() || undefined,
      content: toResumeRenderContent(input.content),
      jobTitle: input.jobTitle.trim(),
      companyName: input.companyName.trim(),
      jobDescription: input.jobDescription?.trim() || "",
      customPrompt: input.customPrompt?.trim() || undefined,
      resumeFileBaseName: input.resumeFileBaseName?.trim() || undefined,
      profileName: input.profileName?.trim() || undefined,
      resumeId: input.resumeId?.trim() || undefined,
    }),
  });

  const data = await readJson(res);
  if (!res.ok) throwAuthAware(res, data);
  return normalizeRenderResponse(data);
}

/** Load the backend-stored PDF for preview (never regenerate in the browser). */
export async function fetchRenderedPdf(
  archiveId: string,
  preferredFileName?: string
): Promise<{ blob: Blob; fileName: string }> {
  return fetchSavedResumeFile(archiveId, "pdf", preferredFileName);
}

/** Load the backend-stored DOCX for download (never rebuild in the browser). */
export async function fetchRenderedDocx(
  archiveId: string,
  preferredFileName?: string
): Promise<{ blob: Blob; fileName: string }> {
  return fetchSavedResumeFile(archiveId, "docx", preferredFileName);
}
