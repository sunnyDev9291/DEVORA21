import { API_BASE_URL } from "@/lib/api-base-url";
import { apiAuthFetch } from "@/lib/api-auth";
import { RESUME_BUILDER_ACCESS_MESSAGE } from "@/lib/resume-access";
import { getUserApiKey } from "@/lib/user-api-key";
import type { SavedResumeArchive, SavedResumeListResponse } from "@/lib/saved-resumes-types";

export type SavedResumeSearchFilters = {
  company?: string;
  jobTitle?: string;
  jd?: string;
  dateFrom?: string;
  dateTo?: string;
};

function parseFileName(res: Response, fallback: string): string {
  const custom =
    res.headers.get("x-resume-name") ??
    res.headers.get("x-pdf-filename") ??
    res.headers.get("x-filename");
  if (custom?.trim()) return custom.trim();

  const disposition = res.headers.get("content-disposition") ?? "";
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/"/g, ""));
    } catch {
      return utf8Match[1].replace(/"/g, "");
    }
  }
  const quotedMatch = disposition.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1];
  const plainMatch = disposition.match(/filename=([^;]+)/i);
  if (plainMatch?.[1]) return plainMatch[1].trim().replace(/"/g, "");

  return fallback;
}

function resolveArchiveFileName(
  item: Pick<SavedResumeArchive, "resumeFileName" | "pdfFileName">,
  format: "docx" | "pdf"
): string {
  if (format === "docx") return item.resumeFileName;
  return (
    item.pdfFileName?.trim() ||
    item.resumeFileName.replace(/\.docx$/i, ".pdf")
  );
}

function archivesAuthError(status: number, fallback: string): Error {
  if (status === 401) {
    return new Error(
      getUserApiKey()
        ? "Authentication failed. Reconnect your dv21_ API key and try again."
        : "Authentication required. Sign in or connect a dv21_ API key, then try again."
    );
  }
  if (status === 403) {
    return new Error(RESUME_BUILDER_ACCESS_MESSAGE);
  }
  return new Error(fallback);
}

export async function listSavedResumes(filters: SavedResumeSearchFilters = {}): Promise<SavedResumeArchive[]> {
  const params = new URLSearchParams();
  const company = filters.company?.trim();
  const jobTitle = filters.jobTitle?.trim();
  const jd = filters.jd?.trim();
  const dateFrom = filters.dateFrom?.trim();
  const dateTo = filters.dateTo?.trim();
  if (company) params.set("company", company);
  if (jobTitle) params.set("jobTitle", jobTitle);
  if (jd) params.set("jd", jd);
  if (dateFrom) params.set("from", dateFrom);
  if (dateTo) params.set("to", dateTo);

  const url = `${API_BASE_URL}/resume/archives${params.size ? `?${params}` : ""}`;
  const res = await apiAuthFetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const data = (await res.json().catch(() => ({}))) as SavedResumeListResponse & {
    error?: string;
    message?: string;
  };

  if (!res.ok) {
    throw archivesAuthError(
      res.status,
      data.error || data.message || `Could not load saved resumes (${res.status}).`
    );
  }

  return data.items ?? [];
}

export async function fetchSavedResumeFile(
  id: string,
  format: "docx" | "pdf",
  preferredFileName?: string
): Promise<{ blob: Blob; fileName: string }> {
  const res = await apiAuthFetch(
    `${API_BASE_URL}/resume/archives/${encodeURIComponent(id)}/${format}`,
    { method: "GET" }
  );

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw archivesAuthError(
      res.status,
      data.error || data.message || `Could not download file (${res.status}).`
    );
  }

  const blob = await res.blob();
  const fallback = preferredFileName?.trim() || (format === "pdf" ? "resume.pdf" : "resume.docx");
  const fileName = parseFileName(res, fallback);
  return { blob, fileName };
}

export { resolveArchiveFileName };

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
