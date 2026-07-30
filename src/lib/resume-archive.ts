import { API_BASE_URL } from "@/lib/api-base-url";
import { apiAuthFetch } from "@/lib/api-auth";
import { RESUME_BUILDER_ACCESS_MESSAGE } from "@/lib/resume-access";
import { getUserApiKey } from "@/lib/user-api-key";

export interface ResumeArchiveResponse {
  id?: string;
  resumeName: string;
  pdfFileName: string;
  pdfBase64: string;
}

export interface ResumeArchivePayload {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  docxBlob: Blob;
  fileName: string;
  datetime?: string;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Could not read PDF response."));
    reader.readAsDataURL(blob);
  });
}

function parsePdfFileName(res: Response, fallback: string): string {
  return (
    res.headers.get("x-pdf-filename") ??
    res.headers.get("content-disposition")?.match(/filename="?([^"]+)"?/)?.[1] ??
    fallback
  );
}

function buildArchiveFormData(payload: ResumeArchivePayload): FormData {
  const form = new FormData();
  form.append("jobTitle", payload.jobTitle.trim());
  form.append("companyName", payload.companyName.trim());
  form.append("jobDescription", payload.jobDescription.trim());
  form.append("datetime", payload.datetime ?? new Date().toISOString());
  form.append("resumeFileName", payload.fileName);
  form.append("resume", payload.docxBlob, payload.fileName);
  return form;
}

function archiveAuthError(status: number, fallback: string): Error {
  if (status === 401) {
    return new Error(
      getUserApiKey()
        ? "Authentication failed for archive. Reconnect your dv21_ API key and try again."
        : "Authentication required. Sign in or connect a dv21_ API key, then try again."
    );
  }
  if (status === 403) {
    return new Error(RESUME_BUILDER_ACCESS_MESSAGE);
  }
  return new Error(fallback);
}

/**
 * POST /resume/archive — cookies and/or Bearer dv21_ key via apiAuthFetch.
 * Do not set Content-Type; the browser sets multipart boundary.
 */
export async function archiveResume(payload: ResumeArchivePayload): Promise<ResumeArchiveResponse> {
  const form = buildArchiveFormData(payload);

  const res = await apiAuthFetch(`${API_BASE_URL}/resume/archive`, {
    method: "POST",
    body: form,
  });

  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/pdf")) {
    if (!res.ok) {
      throw archiveAuthError(res.status, `Archive failed (${res.status}).`);
    }
    const pdfBlob = await res.blob();
    const pdfBase64 = await blobToBase64(pdfBlob);
    const pdfFileName = parsePdfFileName(res, payload.fileName.replace(/\.docx$/i, ".pdf"));
    const resumeName = res.headers.get("x-resume-name") ?? payload.fileName;
    return { resumeName, pdfFileName, pdfBase64 };
  }

  const data = (await res.json()) as ResumeArchiveResponse & { error?: string; message?: string };

  if (!res.ok) {
    throw archiveAuthError(
      res.status,
      data.error || data.message || `Archive failed (${res.status}).`
    );
  }

  if (!data.pdfBase64 || !data.pdfFileName) {
    throw new Error("Backend did not return a PDF file.");
  }

  return {
    id: data.id,
    resumeName: data.resumeName || payload.fileName,
    pdfFileName: data.pdfFileName,
    pdfBase64: data.pdfBase64,
  };
}
