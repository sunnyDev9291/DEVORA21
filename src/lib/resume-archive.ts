import { API_BASE_URL } from "@/lib/api-base-url";

export interface ResumeArchiveResponse {
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

/**
 * Call the backend archive API directly so the browser sends session cookies
 * (api.devora21.com). The Next.js /api/resume/archive proxy cannot attach
 * cross-origin httpOnly cookies from the client.
 */
export async function archiveResume(payload: ResumeArchivePayload): Promise<ResumeArchiveResponse> {
  const form = buildArchiveFormData(payload);

  const res = await fetch(`${API_BASE_URL}/resume/archive`, {
    method: "POST",
    body: form,
    credentials: "include",
  });

  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/pdf")) {
    if (!res.ok) {
      throw new Error(`Archive failed (${res.status}).`);
    }
    const pdfBlob = await res.blob();
    const pdfBase64 = await blobToBase64(pdfBlob);
    const pdfFileName = parsePdfFileName(res, payload.fileName.replace(/\.docx$/i, ".pdf"));
    const resumeName = res.headers.get("x-resume-name") ?? payload.fileName;
    return { resumeName, pdfFileName, pdfBase64 };
  }

  const data = (await res.json()) as ResumeArchiveResponse & { error?: string; message?: string };

  if (!res.ok) {
    throw new Error(data.error || data.message || `Archive failed (${res.status}).`);
  }

  if (!data.pdfBase64 || !data.pdfFileName) {
    throw new Error("Backend did not return a PDF file.");
  }

  return {
    resumeName: data.resumeName || payload.fileName,
    pdfFileName: data.pdfFileName,
    pdfBase64: data.pdfBase64,
  };
}
