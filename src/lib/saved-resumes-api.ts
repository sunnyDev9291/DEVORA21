import { API_BASE_URL } from "@/lib/api-base-url";
import { apiAuthFetch } from "@/lib/api-auth";
import { RESUME_BUILDER_ACCESS_MESSAGE } from "@/lib/resume-access";
import { getUserApiKey } from "@/lib/user-api-key";
import type {
  InterviewHistoryEntry,
  InterviewRoundRecordResponse,
  OtherInterviewProgressItem,
  OtherInterviewProgressResponse,
  SavedResumeArchive,
  SavedResumeJobDescriptionResponse,
  SavedResumeListResponse,
} from "@/lib/saved-resumes-types";

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

function pickString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toBool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return undefined;
}

export function normalizeInterviewHistory(raw: unknown): InterviewHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: InterviewHistoryEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const round = Number(o.round ?? o.n ?? o.interviewRound);
    const downloadedAt = pickString(
      o,
      "downloadedAt",
      "downloaded_at",
      "recordedAt",
      "recorded_at",
      "at"
    );
    if (!Number.isFinite(round) || round < 1 || !downloadedAt) continue;
    out.push({ round: Math.floor(round), downloadedAt });
  }
  return out.sort((a, b) => a.round - b.round || a.downloadedAt.localeCompare(b.downloadedAt));
}

export function resolveNextInterviewRound(
  history: InterviewHistoryEntry[],
  explicit?: unknown
): number {
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit >= 1) {
    return Math.floor(explicit);
  }
  if (typeof explicit === "string" && explicit.trim()) {
    const n = Number(explicit);
    if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  }
  if (!history.length) return 1;
  return Math.max(...history.map((h) => h.round)) + 1;
}

function formatInterviewDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso || "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Applied (bid) step — not an interview round. */
export function formatAppliedLabel(bidAt: string): string {
  return `Applied: ${formatInterviewDateLabel(bidAt)}`;
}

/** Format like "Round 1: Oct 14, 2026" */
export function formatInterviewRoundLabel(round: number, downloadedAt: string): string {
  return `Round ${round}: ${formatInterviewDateLabel(downloadedAt)}`;
}

/**
 * Normalize list rows and drop full JD text from memory.
 * Prefer hasJobDescription from the API; fall back to whether JD was present.
 */
export function normalizeSavedResumeListItem(raw: unknown): SavedResumeArchive | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = pickString(row, "id", "_id", "archiveId");
  if (!id) return null;

  const jobDescriptionRaw = pickString(row, "jobDescription", "job_description", "jd");
  const hasFlag = toBool(row.hasJobDescription ?? row.has_job_description ?? row.hasJd);
  const hasJobDescription =
    hasFlag !== undefined ? hasFlag : Boolean(jobDescriptionRaw);

  const interviewHistory = normalizeInterviewHistory(
    row.interviewHistory ?? row.interview_history ?? row.interviews
  );
  const nextInterviewRound = resolveNextInterviewRound(
    interviewHistory,
    row.nextInterviewRound ?? row.next_interview_round
  );

  return {
    id,
    bidAt: pickString(row, "bidAt", "bid_at", "createdAt", "created_at") || new Date(0).toISOString(),
    jobTitle: pickString(row, "jobTitle", "job_title", "title"),
    companyName: pickString(row, "companyName", "company_name", "company"),
    hasJobDescription,
    // Intentionally omit jobDescription on list items — fetch on demand.
    resumeFileName: pickString(row, "resumeFileName", "resume_file_name", "fileName") || "resume.docx",
    pdfFileName: pickString(row, "pdfFileName", "pdf_file_name") || undefined,
    interviewHistory,
    nextInterviewRound,
  };
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
  // Ask backend for lean list (omit JD bodies) when supported.
  params.set("includeJobDescription", "false");
  params.set("fields", "lean");
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
    items?: unknown[];
    archives?: unknown[];
    data?: unknown[];
  };

  if (!res.ok) {
    throw archivesAuthError(
      res.status,
      data.error || data.message || `Could not load saved resumes (${res.status}).`
    );
  }

  const rawList = Array.isArray(data.items)
    ? data.items
    : Array.isArray(data.archives)
      ? data.archives
      : Array.isArray(data.data)
        ? data.data
        : [];

  return rawList
    .map(normalizeSavedResumeListItem)
    .filter((item): item is SavedResumeArchive => Boolean(item));
}

/**
 * Load full job description for one archive (on-demand when user opens JD).
 * Prefers GET /resume/archives/:id/job-description; falls back to legacy full-item GET.
 */
export async function fetchSavedResumeJobDescription(
  id: string
): Promise<SavedResumeJobDescriptionResponse> {
  const archiveId = id.trim();
  if (!archiveId) throw new Error("Archive id is required.");

  const candidates = [
    `${API_BASE_URL}/resume/archives/${encodeURIComponent(archiveId)}/job-description`,
    `${API_BASE_URL}/resume/archives/${encodeURIComponent(archiveId)}/jd`,
    `${API_BASE_URL}/resume/archives/${encodeURIComponent(archiveId)}`,
  ];

  let lastError: Error | null = null;
  for (const url of candidates) {
    try {
      const res = await apiAuthFetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
        error?: string;
        message?: string;
      };

      if (!res.ok) {
        lastError = archivesAuthError(
          res.status,
          data.error || data.message || `Could not load job description (${res.status}).`
        );
        if (res.status === 404 || res.status === 501) continue;
        throw lastError;
      }

      const nested =
        data.archive && typeof data.archive === "object"
          ? (data.archive as Record<string, unknown>)
          : data.item && typeof data.item === "object"
            ? (data.item as Record<string, unknown>)
            : data;

      const jobDescription = pickString(
        nested,
        "jobDescription",
        "job_description",
        "jd",
        "description",
        "content"
      );

      return {
        id: pickString(nested, "id", "_id") || archiveId,
        jobDescription,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (err instanceof Error && /401|403|Authentication|Admin access/i.test(err.message)) {
        throw err;
      }
    }
  }

  throw lastError ?? new Error("Could not load job description.");
}

/**
 * Record the next interview round when the user downloads for Round N.
 * Body: { action: "round" }
 */
export async function recordInterviewRound(
  id: string,
  action: "round" | "other" = "round"
): Promise<InterviewRoundRecordResponse> {
  const archiveId = id.trim();
  if (!archiveId) throw new Error("Archive id is required.");

  const res = await apiAuthFetch(
    `${API_BASE_URL}/resume/archives/${encodeURIComponent(archiveId)}/interview-rounds`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action }),
    }
  );

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: string;
    message?: string;
  };

  if (!res.ok) {
    throw archivesAuthError(
      res.status,
      data.error || data.message || `Could not record interview round (${res.status}).`
    );
  }

  const interviewHistory = normalizeInterviewHistory(
    data.interviewHistory ?? data.interview_history
  );
  return {
    id: pickString(data, "id", "_id") || archiveId,
    bidAt: pickString(data, "bidAt", "bid_at") || undefined,
    interviewHistory,
    nextInterviewRound: resolveNextInterviewRound(
      interviewHistory,
      data.nextInterviewRound ?? data.next_interview_round
    ),
    recordedRound:
      typeof data.recordedRound === "number"
        ? data.recordedRound
        : typeof data.recorded_round === "number"
          ? data.recorded_round
          : undefined,
    recordedAt: pickString(data, "recordedAt", "recorded_at") || undefined,
  };
}

/**
 * Remove a recorded interview round (user mistake correction).
 * DELETE /resume/archives/:id/interview-rounds/:round
 */
export async function deleteInterviewRound(
  id: string,
  round: number
): Promise<InterviewRoundRecordResponse> {
  const archiveId = id.trim();
  const roundNum = Math.floor(Number(round));
  if (!archiveId) throw new Error("Archive id is required.");
  if (!Number.isFinite(roundNum) || roundNum < 1) {
    throw new Error("Round number is required.");
  }

  const res = await apiAuthFetch(
    `${API_BASE_URL}/resume/archives/${encodeURIComponent(archiveId)}/interview-rounds/${roundNum}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: string;
    message?: string;
  };

  if (!res.ok) {
    throw archivesAuthError(
      res.status,
      data.error || data.message || `Could not delete interview round (${res.status}).`
    );
  }

  const interviewHistory = normalizeInterviewHistory(
    data.interviewHistory ?? data.interview_history
  );
  return {
    id: pickString(data, "id", "_id") || archiveId,
    bidAt: pickString(data, "bidAt", "bid_at") || undefined,
    interviewHistory,
    nextInterviewRound: resolveNextInterviewRound(
      interviewHistory,
      data.nextInterviewRound ?? data.next_interview_round
    ),
    deletedRound:
      typeof data.deletedRound === "number"
        ? data.deletedRound
        : typeof data.deleted_round === "number"
          ? data.deleted_round
          : roundNum,
  };
}

export async function fetchInterviewHistory(id: string): Promise<{
  id: string;
  bidAt?: string;
  interviewHistory: InterviewHistoryEntry[];
  nextInterviewRound: number;
}> {
  const archiveId = id.trim();
  if (!archiveId) throw new Error("Archive id is required.");

  const res = await apiAuthFetch(
    `${API_BASE_URL}/resume/archives/${encodeURIComponent(archiveId)}/interview-history`,
    { method: "GET", headers: { Accept: "application/json" } }
  );
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    throw archivesAuthError(
      res.status,
      data.error || data.message || `Could not load interview history (${res.status}).`
    );
  }
  const interviewHistory = normalizeInterviewHistory(
    data.interviewHistory ?? data.interview_history
  );
  return {
    id: pickString(data, "id", "_id") || archiveId,
    bidAt: pickString(data, "bidAt", "bid_at") || undefined,
    interviewHistory,
    nextInterviewRound: resolveNextInterviewRound(
      interviewHistory,
      data.nextInterviewRound ?? data.next_interview_round
    ),
  };
}

function normalizeOtherProgressItem(raw: unknown): OtherInterviewProgressItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = pickString(row, "id", "_id", "archiveId");
  if (!id) return null;

  const profile =
    row.profile && typeof row.profile === "object"
      ? (row.profile as Record<string, unknown>)
      : null;

  const interviewHistory = normalizeInterviewHistory(
    row.interviewHistory ?? row.interview_history ?? row.interviews
  );
  // Only surfaces that already completed at least Round 1.
  if (!interviewHistory.some((entry) => entry.round >= 1)) return null;

  return {
    id,
    profileId:
      pickString(row, "profileId", "userId", "user_id") ||
      pickString(profile ?? {}, "id", "_id") ||
      undefined,
    profileName:
      pickString(row, "profileName", "userName", "fullName", "name") ||
      pickString(profile ?? {}, "name", "fullName") ||
      undefined,
    profileEmail:
      pickString(row, "profileEmail", "userEmail", "email") ||
      pickString(profile ?? {}, "email") ||
      undefined,
    jobTitle: pickString(row, "jobTitle", "job_title", "title") || "Untitled role",
    companyName: pickString(row, "companyName", "company_name", "company"),
    bidAt:
      pickString(row, "bidAt", "bid_at", "createdAt", "created_at") ||
      new Date(0).toISOString(),
    interviewHistory,
    nextInterviewRound: resolveNextInterviewRound(
      interviewHistory,
      row.nextInterviewRound ?? row.next_interview_round
    ),
  };
}

/**
 * Find other profiles’ archives at the same company that already completed Round 1+.
 * Read-only. Prefers admin route; falls back to resume archives peer-progress.
 */
export async function findOtherInterviewProgress(options: {
  companyName: string;
  excludeArchiveId?: string;
}): Promise<OtherInterviewProgressResponse> {
  const company = options.companyName.trim();
  if (!company) throw new Error("Company name is required.");

  const params = new URLSearchParams();
  params.set("company", company);
  params.set("companyName", company);
  params.set("minCompletedRound", "1");
  params.set("minRound", "1");
  const exclude = options.excludeArchiveId?.trim();
  if (exclude) {
    params.set("excludeId", exclude);
    params.set("excludeArchiveId", exclude);
  }

  const candidates = [
    `${API_BASE_URL}/admin/resumes/other-progress?${params}`,
    `${API_BASE_URL}/resume/archives/other-progress?${params}`,
    `${API_BASE_URL}/resume/archives/peer-progress?${params}`,
  ];

  let lastError: Error | null = null;
  for (const url of candidates) {
    try {
      const res = await apiAuthFetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
        error?: string;
        message?: string;
      };

      if (!res.ok) {
        lastError = archivesAuthError(
          res.status,
          data.error || data.message || `Could not find other progress (${res.status}).`
        );
        if (res.status === 404 || res.status === 501) continue;
        // 403 on admin route → try next (non-admin) candidate
        if (res.status === 403) continue;
        throw lastError;
      }

      const rawItems = Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.archives)
          ? data.archives
          : Array.isArray(data.results)
            ? data.results
            : [];

      const items: OtherInterviewProgressItem[] = [];
      for (const raw of rawItems) {
        const item = normalizeOtherProgressItem(raw);
        if (!item) continue;
        if (exclude && item.id === exclude) continue;
        items.push(item);
      }

      items.sort((a, b) => {
        const aMax = Math.max(0, ...a.interviewHistory.map((e) => e.round));
        const bMax = Math.max(0, ...b.interviewHistory.map((e) => e.round));
        if (bMax !== aMax) return bMax - aMax;
        return (b.bidAt || "").localeCompare(a.bidAt || "");
      });

      return {
        items,
        companyName: pickString(data, "companyName", "company") || company,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("Could not find other interview progress.");
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
