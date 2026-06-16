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

export async function archiveResume(payload: ResumeArchivePayload): Promise<ResumeArchiveResponse> {
  const form = new FormData();
  form.append("jobTitle", payload.jobTitle.trim());
  form.append("companyName", payload.companyName.trim());
  form.append("jobDescription", payload.jobDescription.trim());
  form.append("datetime", payload.datetime ?? new Date().toISOString());
  form.append("resumeFileName", payload.fileName);
  form.append("resume", payload.docxBlob, payload.fileName);

  const res = await fetch("/api/resume/archive", {
    method: "POST",
    body: form,
  });

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
