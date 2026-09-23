import { archiveResume, type ResumeArchiveResponse } from "@/lib/resume-archive";
import { extractResumeTitleHeadline } from "@/lib/resume-filename";
import type { GeneratedResumeContent, ResumeBuildResponse } from "@/lib/resume-types";
import { notifyTodaysResumeCountChanged } from "@/lib/todays-resume-count";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export type BuildResumeDocxInput = {
  templateName: string;
  templateBase64: string;
  content: GeneratedResumeContent;
  customPrompt?: string;
  resumeFileBaseName?: string;
  profileName?: string;
  signal?: AbortSignal;
};

export type BuildResumeDocxResult = {
  docxBase64: string;
  fileName: string;
  templateName: string;
};

/** Same /api/resume/build call used by New resume Apply. */
export async function buildResumeDocx(
  input: BuildResumeDocxInput
): Promise<BuildResumeDocxResult> {
  const res = await fetch("/api/resume/build", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      templateName: input.templateName,
      templateBase64: input.templateBase64,
      customPrompt: input.customPrompt?.trim() || undefined,
      content: input.content,
      resumeFileBaseName: input.resumeFileBaseName?.trim() || undefined,
      profileName: input.profileName,
    }),
    signal: input.signal,
  });

  const data = (await res.json()) as ResumeBuildResponse & { error?: string };
  if (!res.ok || !data.docxBase64 || !data.fileName) {
    throw new Error(data.error || `DOCX build failed (${res.status}).`);
  }

  return {
    docxBase64: data.docxBase64,
    fileName: data.fileName,
    templateName: data.templateName,
  };
}

export type BuildAndArchiveResumeInput = BuildResumeDocxInput & {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
};

export type BuildAndArchiveResumeResult = BuildResumeDocxResult & {
  archive: ResumeArchiveResponse;
};

/** Build DOCX via FE filler, then archive to PDF — identical to New resume Apply. */
export async function buildAndArchiveResume(
  input: BuildAndArchiveResumeInput
): Promise<BuildAndArchiveResumeResult> {
  const built = await buildResumeDocx(input);
  const archive = await archiveResume({
    jobTitle: extractResumeTitleHeadline(input.content.title) || input.jobTitle,
    companyName: input.companyName,
    jobDescription: input.jobDescription,
    docxBlob: base64ToBlob(built.docxBase64, DOCX_MIME),
    fileName: built.fileName,
  });
  notifyTodaysResumeCountChanged();
  return { ...built, archive };
}
