import { API_BASE_URL } from "@/lib/api-base-url";
import { apiAuthFetch } from "@/lib/api-auth";
import { ApiError } from "@/lib/auth-api";

/** How the resume was produced. */
export type AdminResumeGenerationMethod = "web_ui" | "one_click_api" | "unknown";

export type AdminDatePreset = "today" | "week" | "month" | "all" | "custom";

export type AdminResumeSortField =
  | "createdAt"
  | "companyName"
  | "jobTitle"
  | "profileName"
  | "generationMethod";

export type AdminResumeSortDir = "asc" | "desc";

export type AdminResumeFilters = {
  q?: string;
  company?: string;
  jobTitle?: string;
  jobDescription?: string;
  profileName?: string;
  profileId?: string;
  generationMethod?: AdminResumeGenerationMethod | "all";
  preset?: AdminDatePreset;
  from?: string;
  to?: string;
  timezone?: string;
  page?: number;
  limit?: number;
  sortBy?: AdminResumeSortField;
  sortDir?: AdminResumeSortDir;
};

export type AdminResumeRecord = {
  id: string;
  profileId: string;
  profileEmail?: string;
  profileName?: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  createdAt: string;
  generationMethod: AdminResumeGenerationMethod;
  resumeFileName: string;
  pdfFileName?: string;
  hasDocx?: boolean;
  hasPdf?: boolean;
};

export type AdminResumeListResponse = {
  items: AdminResumeRecord[];
  total: number;
  page: number;
  limit: number;
};

export type AdminResumePeriodTotals = {
  today: number;
  week: number;
  month: number;
  allTime: number;
  range: number;
  previousRange?: number;
};

export type AdminResumeSeriesPoint = {
  date: string;
  count: number;
  previousCount?: number;
  webUi?: number;
  oneClickApi?: number;
};

export type AdminResumeProfileStat = {
  profileId: string;
  profileName?: string;
  profileEmail?: string;
  count: number;
  today?: number;
  week?: number;
  month?: number;
  allTime?: number;
};

export type AdminResumeAnalyticsResponse = {
  timezone: string;
  from: string;
  to: string;
  totals: AdminResumePeriodTotals;
  series: AdminResumeSeriesPoint[];
  byMethod: { method: AdminResumeGenerationMethod; count: number }[];
  topProfiles: AdminResumeProfileStat[];
  profileStats?: AdminResumeProfileStat[];
};

function pickString(data: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toNum(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return 0;
}

function normalizeMethod(raw: unknown): AdminResumeGenerationMethod {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (v === "web_ui" || v === "webui" || v === "ui" || v === "web") return "web_ui";
  if (
    v === "one_click_api" ||
    v === "one_click" ||
    v === "oneclick" ||
    v === "api" ||
    v === "from_job"
  ) {
    return "one_click_api";
  }
  return "unknown";
}

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function adminFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return apiAuthFetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });
}

async function adminJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await adminFetch(path, options);
  const data = await parseJson<Record<string, unknown> & T>(res);
  if (!res.ok) {
    const message =
      (data && typeof data.message === "string" && data.message) ||
      (data && typeof data.error === "string" && data.error) ||
      (res.status === 403
        ? "Super Admin access required."
        : res.status === 401
          ? "Sign in to Devora21 first, then open Super Admin."
          : "Request failed");
    throw new ApiError(message, res.status, { message });
  }
  return data as T;
}

function buildQuery(filters: AdminResumeFilters): string {
  const params = new URLSearchParams();
  const set = (key: string, value: string | number | undefined) => {
    if (value === undefined || value === "") return;
    params.set(key, String(value));
  };

  set("q", filters.q?.trim());
  set("company", filters.company?.trim());
  set("jobTitle", filters.jobTitle?.trim());
  set("jobDescription", filters.jobDescription?.trim());
  set("jd", filters.jobDescription?.trim());
  set("profileName", filters.profileName?.trim());
  set("profileId", filters.profileId?.trim());
  set("userId", filters.profileId?.trim());
  if (filters.generationMethod && filters.generationMethod !== "all") {
    set("generationMethod", filters.generationMethod);
    set("method", filters.generationMethod);
  }
  set("preset", filters.preset);
  set("from", filters.from?.trim());
  set("to", filters.to?.trim());
  set("timezone", filters.timezone?.trim() || guessBrowserTimezone());
  set("page", filters.page);
  set("limit", filters.limit);
  set("sortBy", filters.sortBy);
  set("sortDir", filters.sortDir);
  return params.toString();
}

export function guessBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function normalizeResumeRecord(raw: unknown): AdminResumeRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = pickString(row, "id", "_id", "archiveId");
  if (!id) return null;

  const profile =
    row.profile && typeof row.profile === "object"
      ? (row.profile as Record<string, unknown>)
      : null;

  return {
    id,
    profileId:
      pickString(row, "profileId", "userId", "user_id") ||
      pickString(profile ?? {}, "id", "_id") ||
      "",
    profileEmail:
      pickString(row, "profileEmail", "userEmail", "email") ||
      pickString(profile ?? {}, "email") ||
      undefined,
    profileName:
      pickString(row, "profileName", "userName", "fullName") ||
      pickString(profile ?? {}, "name", "fullName") ||
      undefined,
    jobTitle: pickString(row, "jobTitle", "job_title", "title"),
    companyName: pickString(row, "companyName", "company_name", "company"),
    jobDescription: pickString(row, "jobDescription", "job_description", "jd"),
    createdAt:
      pickString(row, "createdAt", "created_at", "bidAt", "bid_at", "datetime") ||
      new Date(0).toISOString(),
    generationMethod: normalizeMethod(
      row.generationMethod ?? row.generation_method ?? row.method ?? row.source
    ),
    resumeFileName:
      pickString(row, "resumeFileName", "resume_file_name", "docxFileName") ||
      "resume.docx",
    pdfFileName: pickString(row, "pdfFileName", "pdf_file_name") || undefined,
    hasDocx:
      typeof row.hasDocx === "boolean"
        ? row.hasDocx
        : Boolean(pickString(row, "resumeFileName", "resume_file_name", "docxStorageKey")),
    hasPdf:
      typeof row.hasPdf === "boolean"
        ? row.hasPdf
        : Boolean(pickString(row, "pdfFileName", "pdf_file_name", "pdfStorageKey")),
  };
}

function normalizeAnalytics(data: Record<string, unknown>): AdminResumeAnalyticsResponse {
  const totalsRaw =
    data.totals && typeof data.totals === "object"
      ? (data.totals as Record<string, unknown>)
      : data;

  const seriesRaw = Array.isArray(data.series)
    ? data.series
    : Array.isArray(data.timeline)
      ? data.timeline
      : Array.isArray(data.daily)
        ? data.daily
        : [];

  const series: AdminResumeSeriesPoint[] = [];
  for (const point of seriesRaw) {
    if (!point || typeof point !== "object") continue;
    const p = point as Record<string, unknown>;
    const date = pickString(p, "date", "day", "bucket", "label");
    if (!date) continue;
    const entry: AdminResumeSeriesPoint = {
      date,
      count: toNum(p.count ?? p.total ?? p.value),
    };
    if (p.previousCount !== undefined || p.previous !== undefined) {
      entry.previousCount = toNum(p.previousCount ?? p.previous);
    }
    if (p.webUi !== undefined || p.web_ui !== undefined) {
      entry.webUi = toNum(p.webUi ?? p.web_ui);
    }
    if (p.oneClickApi !== undefined || p.one_click_api !== undefined) {
      entry.oneClickApi = toNum(p.oneClickApi ?? p.one_click_api);
    }
    series.push(entry);
  }

  const methodRaw = Array.isArray(data.byMethod)
    ? data.byMethod
    : Array.isArray(data.methods)
      ? data.methods
      : [];

  const byMethod = methodRaw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      return {
        method: normalizeMethod(r.method ?? r.generationMethod ?? r.key),
        count: toNum(r.count ?? r.total),
      };
    })
    .filter((r): r is { method: AdminResumeGenerationMethod; count: number } => Boolean(r));

  const profileRaw = Array.isArray(data.topProfiles)
    ? data.topProfiles
    : Array.isArray(data.profiles)
      ? data.profiles
      : [];

  const mapProfile = (row: unknown): AdminResumeProfileStat | null => {
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    const profileId = pickString(r, "profileId", "userId", "id", "user_id");
    if (!profileId) return null;
    return {
      profileId,
      profileName: pickString(r, "profileName", "name", "fullName") || undefined,
      profileEmail: pickString(r, "profileEmail", "email") || undefined,
      count: toNum(r.count ?? r.total ?? r.range),
      today: r.today !== undefined ? toNum(r.today) : undefined,
      week: r.week !== undefined ? toNum(r.week) : undefined,
      month: r.month !== undefined ? toNum(r.month) : undefined,
      allTime: r.allTime !== undefined || r.all_time !== undefined
        ? toNum(r.allTime ?? r.all_time)
        : undefined,
    };
  };

  const topProfiles = profileRaw
    .map(mapProfile)
    .filter((p): p is AdminResumeProfileStat => Boolean(p));

  const profileStatsRaw = Array.isArray(data.profileStats) ? data.profileStats : [];
  const profileStats = profileStatsRaw
    .map(mapProfile)
    .filter((p): p is AdminResumeProfileStat => Boolean(p));

  return {
    timezone: pickString(data, "timezone", "tz") || guessBrowserTimezone(),
    from: pickString(data, "from", "dateFrom", "start"),
    to: pickString(data, "to", "dateTo", "end"),
    totals: {
      today: toNum(totalsRaw.today ?? totalsRaw.daily),
      week: toNum(totalsRaw.week ?? totalsRaw.weekly),
      month: toNum(totalsRaw.month ?? totalsRaw.monthly),
      allTime: toNum(totalsRaw.allTime ?? totalsRaw.all_time ?? totalsRaw.total),
      range: toNum(totalsRaw.range ?? totalsRaw.current ?? totalsRaw.count),
      previousRange:
        totalsRaw.previousRange !== undefined || totalsRaw.previous !== undefined
          ? toNum(totalsRaw.previousRange ?? totalsRaw.previous)
          : undefined,
    },
    series,
    byMethod,
    topProfiles,
    profileStats: profileStats.length ? profileStats : undefined,
  };
}

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

export const superAdminResumesApi = {
  async getAnalytics(filters: AdminResumeFilters = {}): Promise<AdminResumeAnalyticsResponse> {
    const qs = buildQuery(filters);
    const data = await adminJson<Record<string, unknown>>(
      `/admin/resumes/analytics${qs ? `?${qs}` : ""}`
    );
    return normalizeAnalytics(data);
  },

  async listResumes(filters: AdminResumeFilters = {}): Promise<AdminResumeListResponse> {
    const qs = buildQuery({
      ...filters,
      page: filters.page ?? 1,
      limit: filters.limit ?? 25,
      sortBy: filters.sortBy ?? "createdAt",
      sortDir: filters.sortDir ?? "desc",
    });
    const data = await adminJson<Record<string, unknown>>(
      `/admin/resumes${qs ? `?${qs}` : ""}`
    );

    const rawList = Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.resumes)
        ? data.resumes
        : Array.isArray(data.data)
          ? data.data
          : [];

    const items = rawList
      .map(normalizeResumeRecord)
      .filter((r): r is AdminResumeRecord => Boolean(r));

    const totalRaw = data.total ?? data.totalCount ?? data.count;
    const total =
      typeof totalRaw === "number" && Number.isFinite(totalRaw) ? totalRaw : items.length;
    const page = toNum(data.page) || filters.page || 1;
    const limit = toNum(data.limit) || filters.limit || 25;

    return { items, total, page, limit };
  },

  async fetchFile(
    id: string,
    format: "docx" | "pdf",
    preferredFileName?: string
  ): Promise<{ blob: Blob; fileName: string }> {
    const candidates = [
      `/admin/resumes/${encodeURIComponent(id)}/${format}`,
      `/resume/archives/${encodeURIComponent(id)}/${format}`,
    ];

    let lastError: Error | null = null;
    for (const path of candidates) {
      try {
        const res = await adminFetch(path, { method: "GET" });
        if (!res.ok) {
          const data = await parseJson<{ message?: string; error?: string }>(res);
          lastError = new ApiError(
            data?.message || data?.error || `Could not download ${format} (${res.status}).`,
            res.status
          );
          if (res.status === 404 || res.status === 501) continue;
          throw lastError;
        }
        const blob = await res.blob();
        const fallback =
          preferredFileName?.trim() || (format === "pdf" ? "resume.pdf" : "resume.docx");
        return { blob, fileName: parseFileName(res, fallback) };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (err instanceof ApiError && err.status !== 404 && err.status !== 501) throw err;
      }
    }
    throw lastError ?? new ApiError(`Could not download ${format}.`, 502);
  },
};

export function formatGenerationMethod(method: AdminResumeGenerationMethod): string {
  if (method === "web_ui") return "Web UI";
  if (method === "one_click_api") return "One-Click API";
  return "Unknown";
}

export function percentChange(current: number, previous: number | undefined): number | null {
  if (previous === undefined) return null;
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
