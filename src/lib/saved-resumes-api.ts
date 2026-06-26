import { API_BASE_URL } from "@/lib/api-base-url";
import { RESUME_BUILDER_ACCESS_MESSAGE } from "@/lib/resume-access";
import type { SavedResumeArchive, SavedResumeListResponse } from "@/lib/saved-resumes-types";

function parseFileName(res: Response, fallback: string): string {
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  if (match?.[1]) return decodeURIComponent(match[1].replace(/"/g, ""));
  return fallback;
}

export async function listSavedResumes(search = ""): Promise<SavedResumeArchive[]> {
  const params = new URLSearchParams();
  const query = search.trim();
  if (query) params.set("q", query);

  const url = `${API_BASE_URL}/resume/archives${params.size ? `?${params}` : ""}`;
  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  const data = (await res.json().catch(() => ({}))) as SavedResumeListResponse & {
    error?: string;
    message?: string;
  };

  if (!res.ok) {
    if (res.status === 403) throw new Error(RESUME_BUILDER_ACCESS_MESSAGE);
    throw new Error(data.error || data.message || `Could not load saved resumes (${res.status}).`);
  }

  return data.items ?? [];
}

export async function fetchSavedResumeFile(
  id: string,
  format: "docx" | "pdf"
): Promise<{ blob: Blob; fileName: string }> {
  const res = await fetch(`${API_BASE_URL}/resume/archives/${encodeURIComponent(id)}/${format}`, {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) {
    if (res.status === 403) throw new Error(RESUME_BUILDER_ACCESS_MESSAGE);
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(data.error || data.message || `Could not download file (${res.status}).`);
  }

  const blob = await res.blob();
  const fallback = format === "pdf" ? "resume.pdf" : "resume.docx";
  return { blob, fileName: parseFileName(res, fallback) };
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
