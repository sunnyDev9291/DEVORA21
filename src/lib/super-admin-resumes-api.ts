import { API_BASE_URL } from "@/lib/api-base-url";
import { apiAuthFetch } from "@/lib/api-auth";
import { ApiError } from "@/lib/auth-api";

export type AdminDatePreset =
  | "today"
  | "week"
  | "last7"
  | "last30"
  | "month"
  | "all"
  | "custom";

export type AdminResumeSortField =
  | "createdAt"
  | "companyName"
  | "jobTitle"
  | "profileName";

export type AdminResumeSortDir = "asc" | "desc";

export type AdminResumeFilters = {
  q?: string;
  company?: string;
  jobTitle?: string;
  jobDescription?: string;
  profileName?: string;
  profileId?: string;
  /** Comma-joined or repeated profile ids for multi-profile analytics. */
  profileIds?: string[];
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
  preset?: string;
  totals: AdminResumePeriodTotals;
  series: AdminResumeSeriesPoint[];
  topProfiles: AdminResumeProfileStat[];
  profileStats?: AdminResumeProfileStat[];
};

export type AdminResumeCompareProfile = {
  profileId: string;
  profileName?: string;
  profileEmail?: string;
};

export type AdminResumeCompareSeriesPoint = {
  date: string;
  total: number;
  /** Daily counts keyed by profileId */
  byProfile: Record<string, number>;
};

export type AdminResumeCompareRanking = AdminResumeCompareProfile & {
  count: number;
  percent: number;
};

export type AdminResumeCompareResponse = {
  timezone: string;
  from: string;
  to: string;
  preset?: string;
  profiles: AdminResumeCompareProfile[];
  series: AdminResumeCompareSeriesPoint[];
  rankings: AdminResumeCompareRanking[];
  grandTotal: number;
  totals?: AdminResumePeriodTotals;
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
  if (filters.profileIds?.length) {
    const ids = filters.profileIds.map((id) => id.trim()).filter(Boolean);
    if (ids.length) {
      params.set("profileIds", ids.join(","));
      for (const id of ids) params.append("profileId", id);
    }
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
    series.push(entry);
  }

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
      allTime:
        r.allTime !== undefined || r.all_time !== undefined
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
    preset: pickString(data, "preset") || undefined,
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

function normalizeCompare(data: Record<string, unknown>): AdminResumeCompareResponse {
  const profileRaw = Array.isArray(data.profiles) ? data.profiles : [];
  const profiles: AdminResumeCompareProfile[] = [];
  for (const row of profileRaw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const profileId = pickString(r, "profileId", "userId", "id");
    if (!profileId) continue;
    profiles.push({
      profileId,
      profileName: pickString(r, "profileName", "name", "fullName") || undefined,
      profileEmail: pickString(r, "profileEmail", "email") || undefined,
    });
  }

  const seriesRaw = Array.isArray(data.series) ? data.series : [];
  const series: AdminResumeCompareSeriesPoint[] = [];
  for (const point of seriesRaw) {
    if (!point || typeof point !== "object") continue;
    const p = point as Record<string, unknown>;
    const date = pickString(p, "date", "day", "bucket");
    if (!date) continue;

    const byProfile: Record<string, number> = {};
    const nested =
      p.byProfile && typeof p.byProfile === "object"
        ? (p.byProfile as Record<string, unknown>)
        : p.profiles && typeof p.profiles === "object"
          ? (p.profiles as Record<string, unknown>)
          : null;

    if (nested) {
      for (const [key, value] of Object.entries(nested)) {
        byProfile[key] = toNum(value);
      }
    } else {
      for (const [key, value] of Object.entries(p)) {
        if (
          key === "date" ||
          key === "day" ||
          key === "bucket" ||
          key === "total" ||
          key === "count" ||
          key === "previousCount"
        ) {
          continue;
        }
        if (typeof value === "number" || typeof value === "string") {
          byProfile[key] = toNum(value);
        }
      }
    }

    const total =
      p.total !== undefined || p.count !== undefined
        ? toNum(p.total ?? p.count)
        : Object.values(byProfile).reduce((sum, n) => sum + n, 0);

    series.push({ date, total, byProfile });
  }

  const rankingRaw = Array.isArray(data.rankings)
    ? data.rankings
    : Array.isArray(data.topProfiles)
      ? data.topProfiles
      : [];

  let rankings: AdminResumeCompareRanking[] = [];
  for (const row of rankingRaw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const profileId = pickString(r, "profileId", "userId", "id");
    if (!profileId) continue;
    rankings.push({
      profileId,
      profileName: pickString(r, "profileName", "name", "fullName") || undefined,
      profileEmail: pickString(r, "profileEmail", "email") || undefined,
      count: toNum(r.count ?? r.total ?? r.range),
      percent: toNum(r.percent ?? r.percentage),
    });
  }

  let grandTotal = toNum(data.grandTotal ?? data.grand_total);
  if (!grandTotal && rankings.length) {
    grandTotal = rankings.reduce((sum, r) => sum + r.count, 0);
  }
  if (!rankings.length && series.length && profiles.length) {
    const counts = new Map<string, number>();
    for (const point of series) {
      for (const [id, n] of Object.entries(point.byProfile)) {
        counts.set(id, (counts.get(id) ?? 0) + n);
      }
    }
    grandTotal = [...counts.values()].reduce((a, b) => a + b, 0);
    rankings = profiles
      .map((p) => {
        const count = counts.get(p.profileId) ?? 0;
        return {
          ...p,
          count,
          percent: grandTotal > 0 ? Math.round((count / grandTotal) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.count - a.count);
  } else if (rankings.some((r) => r.percent === 0) && grandTotal > 0) {
    rankings = rankings.map((r) => ({
      ...r,
      percent: Math.round((r.count / grandTotal) * 1000) / 10,
    }));
  }

  const totalsRaw =
    data.totals && typeof data.totals === "object"
      ? (data.totals as Record<string, unknown>)
      : null;

  return {
    timezone: pickString(data, "timezone", "tz") || guessBrowserTimezone(),
    from: pickString(data, "from", "dateFrom", "start"),
    to: pickString(data, "to", "dateTo", "end"),
    preset: pickString(data, "preset") || undefined,
    profiles,
    series,
    rankings,
    grandTotal,
    totals: totalsRaw
      ? {
          today: toNum(totalsRaw.today),
          week: toNum(totalsRaw.week),
          month: toNum(totalsRaw.month),
          allTime: toNum(totalsRaw.allTime ?? totalsRaw.all_time),
          range: toNum(totalsRaw.range ?? grandTotal),
          previousRange:
            totalsRaw.previousRange !== undefined
              ? toNum(totalsRaw.previousRange)
              : undefined,
        }
      : undefined,
  };
}

function mergePerProfileAnalytics(
  profileMeta: AdminResumeCompareProfile[],
  perProfile: { profileId: string; analytics: AdminResumeAnalyticsResponse }[],
  timezone: string
): AdminResumeCompareResponse {
  const dateSet = new Set<string>();
  for (const row of perProfile) {
    for (const point of row.analytics.series) dateSet.add(point.date);
  }
  const dates = [...dateSet].sort();
  const series: AdminResumeCompareSeriesPoint[] = dates.map((date) => {
    const byProfile: Record<string, number> = {};
    let total = 0;
    for (const row of perProfile) {
      const count = row.analytics.series.find((p) => p.date === date)?.count ?? 0;
      byProfile[row.profileId] = count;
      total += count;
    }
    return { date, total, byProfile };
  });

  const counts = new Map<string, number>();
  for (const point of series) {
    for (const [id, n] of Object.entries(point.byProfile)) {
      counts.set(id, (counts.get(id) ?? 0) + n);
    }
  }
  const grandTotal = [...counts.values()].reduce((a, b) => a + b, 0);
  const rankings: AdminResumeCompareRanking[] = profileMeta
    .map((p) => {
      const count = counts.get(p.profileId) ?? 0;
      return {
        ...p,
        count,
        percent: grandTotal > 0 ? Math.round((count / grandTotal) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  const first = perProfile[0]?.analytics;
  return {
    timezone: first?.timezone || timezone,
    from: first?.from || dates[0] || "",
    to: first?.to || dates[dates.length - 1] || "",
    preset: first?.preset,
    profiles: profileMeta,
    series,
    rankings,
    grandTotal,
    totals: first?.totals
      ? {
          ...first.totals,
          range: grandTotal,
        }
      : undefined,
  };
}

export const superAdminResumesApi = {
  async getAnalytics(filters: AdminResumeFilters = {}): Promise<AdminResumeAnalyticsResponse> {
    const qs = buildQuery(filters);
    const data = await adminJson<Record<string, unknown>>(
      `/admin/resumes/analytics${qs ? `?${qs}` : ""}`
    );
    return normalizeAnalytics(data);
  },

  /**
   * Multi-profile daily series for the advanced compare chart.
   * Prefers GET /admin/resumes/analytics/compare; falls back to parallel per-profile analytics.
   */
  async getCompareAnalytics(
    filters: AdminResumeFilters & { profileIds: string[]; profileMeta?: AdminResumeCompareProfile[] }
  ): Promise<AdminResumeCompareResponse> {
    const ids = filters.profileIds.map((id) => id.trim()).filter(Boolean);
    if (!ids.length) {
      return {
        timezone: guessBrowserTimezone(),
        from: filters.from || "",
        to: filters.to || "",
        preset: filters.preset,
        profiles: [],
        series: [],
        rankings: [],
        grandTotal: 0,
      };
    }

    const qs = buildQuery({ ...filters, profileIds: ids, profileId: undefined });
    try {
      const data = await adminJson<Record<string, unknown>>(
        `/admin/resumes/analytics/compare${qs ? `?${qs}` : ""}`
      );
      return normalizeCompare(data);
    } catch (err) {
      // Prefer batch endpoint; fall back to parallel single-profile analytics when missing.
      if (!(err instanceof ApiError) || (err.status !== 404 && err.status !== 501)) {
        throw err;
      }
    }

    const meta =
      filters.profileMeta?.filter((p) => ids.includes(p.profileId)) ??
      ids.map((profileId) => ({ profileId }));

    const perProfile = await Promise.all(
      ids.map(async (profileId) => {
        const analytics = await this.getAnalytics({
          ...filters,
          profileId,
          profileIds: undefined,
        });
        return { profileId, analytics };
      })
    );

    return mergePerProfileAnalytics(meta, perProfile, guessBrowserTimezone());
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

export function percentChange(current: number, previous: number | undefined): number | null {
  if (previous === undefined) return null;
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
