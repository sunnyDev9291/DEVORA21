import { API_BASE_URL } from "@/lib/api-base-url";
import { apiAuthFetch } from "@/lib/api-auth";
import { ApiError } from "@/lib/auth-api";

export type ApplicationQaOwner = {
  userId: string;
  email: string;
  name?: string;
  sessionCount: number;
  lastSyncedAt?: string;
};

export type ApplicationQaSessionOwner = {
  id?: string;
  email?: string;
  name?: string;
};

export type ApplicationQaSessionSummary = {
  id: string;
  userId: string;
  tabUrl: string;
  pageTitle: string;
  status: "recording" | "paused" | string;
  itemCount: number;
  updatedAt?: string;
  lastSyncedAt?: string;
  owner?: ApplicationQaSessionOwner;
};

export type ApplicationQaItem = {
  id?: string;
  question: string;
  answer: string;
  updatedAt?: string;
};

export type ApplicationQaSessionDetail = ApplicationQaSessionSummary & {
  questionsAnswers: ApplicationQaItem[];
};

export type ApplicationQaSessionsListResponse = {
  page: number;
  limit: number;
  total: number;
  sessions: ApplicationQaSessionSummary[];
};

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

function pickString(data: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return fallback;
}

function throwAdminError(res: Response, data: Record<string, unknown>): never {
  const message =
    (typeof data.message === "string" && data.message) ||
    (typeof data.error === "string" && data.error) ||
    (res.status === 403
      ? "Admin access required. Sign in with a super-admin account."
      : res.status === 401
        ? "Sign in to Devora21 first, then open Super Admin."
        : "Request failed");
  throw new ApiError(message, res.status, { message });
}

async function adminJson(path: string, options: RequestInit = {}): Promise<Record<string, unknown>> {
  const res = await apiAuthFetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });
  const data = await parseJson(res);
  if (!res.ok) throwAdminError(res, data);
  return data;
}

function normalizeOwner(raw: unknown): ApplicationQaOwner | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const userId = pickString(row, "userId", "user_id", "id", "_id");
  if (!userId) return null;
  return {
    userId,
    email: pickString(row, "email"),
    name: pickString(row, "name", "fullName", "full_name") || undefined,
    sessionCount: toNumber(row.sessionCount ?? row.session_count ?? row.count, 0),
    lastSyncedAt:
      pickString(row, "lastSyncedAt", "last_synced_at", "updatedAt", "updated_at") || undefined,
  };
}

function normalizeSessionOwner(raw: unknown): ApplicationQaSessionOwner | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Record<string, unknown>;
  const id = pickString(row, "id", "_id", "userId", "user_id");
  const email = pickString(row, "email");
  const name = pickString(row, "name", "fullName", "full_name");
  if (!id && !email && !name) return undefined;
  return {
    id: id || undefined,
    email: email || undefined,
    name: name || undefined,
  };
}

function normalizeStatus(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (value === "recording" || value === "paused") return value;
  return value || "paused";
}

function normalizeSessionSummary(raw: unknown): ApplicationQaSessionSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = pickString(row, "id", "_id", "sessionId", "session_id");
  if (!id) return null;
  const owner = normalizeSessionOwner(row.owner ?? row.user);
  const userId =
    pickString(row, "userId", "user_id") || owner?.id || "";
  return {
    id,
    userId,
    tabUrl: pickString(row, "tabUrl", "tab_url", "url", "pageUrl", "page_url"),
    pageTitle: pickString(row, "pageTitle", "page_title", "title"),
    status: normalizeStatus(row.status),
    itemCount: toNumber(
      row.itemCount ??
        row.item_count ??
        row.qaCount ??
        row.qa_count ??
        (Array.isArray(row.questionsAnswers) ? row.questionsAnswers.length : undefined) ??
        (Array.isArray(row.questions_answers) ? row.questions_answers.length : undefined),
      0
    ),
    updatedAt: pickString(row, "updatedAt", "updated_at") || undefined,
    lastSyncedAt: pickString(row, "lastSyncedAt", "last_synced_at") || undefined,
    owner,
  };
}

function normalizeQaItem(raw: unknown): ApplicationQaItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const question = pickString(row, "question", "q", "prompt");
  const answer = pickString(row, "answer", "a", "response");
  if (!question && !answer) return null;
  return {
    id: pickString(row, "id", "_id") || undefined,
    question: question || "(no question)",
    answer: answer || "",
    updatedAt: pickString(row, "updatedAt", "updated_at", "answeredAt", "answered_at") || undefined,
  };
}

function extractQaItems(session: Record<string, unknown>): ApplicationQaItem[] {
  const rawList = Array.isArray(session.questionsAnswers)
    ? session.questionsAnswers
    : Array.isArray(session.questions_answers)
      ? session.questions_answers
      : Array.isArray(session.items)
        ? session.items
        : Array.isArray(session.qa)
          ? session.qa
          : [];
  return rawList.map(normalizeQaItem).filter((item): item is ApplicationQaItem => Boolean(item));
}

export function displayApplicationQaOwnerName(
  owner: { name?: string; email?: string; userId?: string; id?: string } | null | undefined
): string {
  if (!owner) return "Unknown owner";
  return (
    owner.name?.trim() ||
    owner.email?.trim() ||
    owner.userId?.trim() ||
    owner.id?.trim() ||
    "Unknown owner"
  );
}

export function truncateUrl(url: string, max = 56): string {
  const value = url.trim();
  if (!value) return "—";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export const superAdminApplicationQaApi = {
  async listOwners(): Promise<ApplicationQaOwner[]> {
    const data = await adminJson("/admin/application-qa/owners");
    const raw = Array.isArray(data.owners)
      ? data.owners
      : Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.data)
          ? data.data
          : [];
    return raw
      .map(normalizeOwner)
      .filter((owner): owner is ApplicationQaOwner => Boolean(owner))
      .sort((a, b) => {
        const bySync = (b.lastSyncedAt || "").localeCompare(a.lastSyncedAt || "");
        if (bySync) return bySync;
        return displayApplicationQaOwnerName(a).localeCompare(displayApplicationQaOwnerName(b));
      });
  },

  async listSessions(params: {
    userId?: string;
    q?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<ApplicationQaSessionsListResponse> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 25));
    const search = new URLSearchParams();
    search.set("page", String(page));
    search.set("limit", String(limit));
    if (params.userId?.trim()) search.set("userId", params.userId.trim());
    if (params.q?.trim()) search.set("q", params.q.trim());

    const data = await adminJson(`/admin/application-qa/sessions?${search.toString()}`);
    const raw = Array.isArray(data.sessions)
      ? data.sessions
      : Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.data)
          ? data.data
          : [];

    return {
      page: toNumber(data.page, page),
      limit: toNumber(data.limit, limit),
      total: toNumber(data.total, raw.length),
      sessions: raw
        .map(normalizeSessionSummary)
        .filter((s): s is ApplicationQaSessionSummary => Boolean(s)),
    };
  },

  async getSession(id: string): Promise<ApplicationQaSessionDetail> {
    const sid = id.trim();
    if (!sid) throw new ApiError("Missing session id.", 400);

    const data = await adminJson(
      `/admin/application-qa/sessions/${encodeURIComponent(sid)}`
    );
    const nested =
      data.session && typeof data.session === "object"
        ? (data.session as Record<string, unknown>)
        : data;
    const summary = normalizeSessionSummary(nested);
    if (!summary) throw new ApiError("Session payload was empty.", 502);

    return {
      ...summary,
      questionsAnswers: extractQaItems(nested),
    };
  },

  async deleteSession(id: string): Promise<void> {
    const sid = id.trim();
    if (!sid) throw new ApiError("Missing session id.", 400);

    await adminJson(`/admin/application-qa/sessions/${encodeURIComponent(sid)}`, {
      method: "DELETE",
    });
  },
};
