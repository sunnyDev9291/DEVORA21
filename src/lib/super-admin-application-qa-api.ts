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
  /** Prefer backend companyName; FE may derive from title/URL when missing. */
  companyName?: string;
  status: "recording" | "paused" | string;
  /** DOM input event count (preferred). */
  eventCount: number;
  /** Alias of eventCount for older payloads / list UIs. */
  itemCount: number;
  updatedAt?: string;
  lastSyncedAt?: string;
  createdAt?: string;
  owner?: ApplicationQaSessionOwner;
};

/** Chronological DOM input capture from the Chrome extension. */
export type ApplicationQaInputEvent = {
  id: string;
  elementKey: string;
  value: string;
  eventType?: string;
  tagName?: string;
  inputType?: string;
  elementId?: string;
  name?: string;
  className?: string;
  cssSelector?: string;
  attributes?: Record<string, string>;
  /** Short element summary — not a scraped "question". */
  label?: string;
  occurredAt: string;
  updatedAt: string;
};

/** @deprecated Compat shape; prefer ApplicationQaInputEvent. */
export type ApplicationQaItem = {
  id?: string;
  question: string;
  answer: string;
  updatedAt?: string;
};

export type ApplicationQaSessionDetail = ApplicationQaSessionSummary & {
  inputEvents: ApplicationQaInputEvent[];
  /** Compat alias (question≈label, answer≈value). */
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

/** Normalize list/detail/SSE session payloads into a stable FE shape. */
export function normalizeSessionSummary(raw: unknown): ApplicationQaSessionSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = pickString(row, "id", "_id", "sessionId", "session_id");
  if (!id) return null;
  const owner = normalizeSessionOwner(row.owner ?? row.user);
  const userId =
    pickString(row, "userId", "user_id") || owner?.id || "";
  const eventCount = toNumber(
    row.eventCount ??
      row.event_count ??
      row.itemCount ??
      row.item_count ??
      row.qaCount ??
      row.qa_count ??
      (Array.isArray(row.inputEvents) ? row.inputEvents.length : undefined) ??
      (Array.isArray(row.input_events) ? row.input_events.length : undefined) ??
      (Array.isArray(row.questionsAnswers) ? row.questionsAnswers.length : undefined) ??
      (Array.isArray(row.questions_answers) ? row.questions_answers.length : undefined),
    0
  );
  return {
    id,
    userId,
    tabUrl: pickString(row, "tabUrl", "tab_url", "url", "pageUrl", "page_url"),
    pageTitle: pickString(row, "pageTitle", "page_title", "title"),
    companyName:
      pickString(row, "companyName", "company_name", "company") || undefined,
    status: normalizeStatus(row.status),
    eventCount,
    itemCount: eventCount,
    updatedAt: pickString(row, "updatedAt", "updated_at") || undefined,
    lastSyncedAt: pickString(row, "lastSyncedAt", "last_synced_at") || undefined,
    createdAt: pickString(row, "createdAt", "created_at", "recordedAt", "recorded_at") || undefined,
    owner,
  };
}

function normalizeAttributes(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") out[key] = value;
    else if (typeof value === "number" || typeof value === "boolean") out[key] = String(value);
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeInputEvent(raw: unknown, index = 0): ApplicationQaInputEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;

  // Prefer DOM event fields; fall back to Q&A compat (question≈label, answer≈value).
  const value =
    pickString(row, "value", "answer", "a", "response") ||
    (typeof row.value === "number" || typeof row.value === "boolean"
      ? String(row.value)
      : "");
  const label =
    pickString(row, "label", "question", "q", "prompt") || undefined;
  const elementKey =
    pickString(row, "elementKey", "element_key", "key") ||
    pickString(row, "id", "_id") ||
    label ||
    "";
  const id =
    pickString(row, "id", "_id") ||
    (elementKey ? `${elementKey}:${index}` : "") ||
    `event-${index}`;
  const occurredAt =
    pickString(row, "occurredAt", "occurred_at", "updatedAt", "updated_at", "answeredAt", "answered_at") ||
    "";
  const updatedAt =
    pickString(row, "updatedAt", "updated_at", "occurredAt", "occurred_at") || occurredAt;

  if (!value && !label && !elementKey && !pickString(row, "tagName", "tag_name", "cssSelector", "css_selector")) {
    return null;
  }

  return {
    id,
    elementKey: elementKey || id,
    value,
    eventType: pickString(row, "eventType", "event_type") || undefined,
    tagName: pickString(row, "tagName", "tag_name", "tag") || undefined,
    inputType: pickString(row, "inputType", "input_type") || undefined,
    elementId: pickString(row, "elementId", "element_id") || undefined,
    name: pickString(row, "name") || undefined,
    className: pickString(row, "className", "class_name", "class") || undefined,
    cssSelector: pickString(row, "cssSelector", "css_selector", "selector") || undefined,
    attributes: normalizeAttributes(row.attributes),
    label,
    occurredAt,
    updatedAt,
  };
}

function sortInputEventsChronological(
  events: ApplicationQaInputEvent[]
): ApplicationQaInputEvent[] {
  return [...events].sort((a, b) => {
    const byTime = (a.occurredAt || "").localeCompare(b.occurredAt || "");
    if (byTime) return byTime;
    return (a.id || "").localeCompare(b.id || "");
  });
}

/** Upsert by id, then elementKey — unchanged re-types / radio groups stay one row. */
export function upsertInputEvents(
  prev: ApplicationQaInputEvent[],
  incoming: ApplicationQaInputEvent[]
): ApplicationQaInputEvent[] {
  if (!incoming.length) return sortInputEventsChronological(prev);
  if (!prev.length) return sortInputEventsChronological(incoming);

  const byId = new Map<string, ApplicationQaInputEvent>();
  const byKey = new Map<string, string>(); // elementKey → id

  for (const event of prev) {
    byId.set(event.id, event);
    if (event.elementKey) byKey.set(event.elementKey, event.id);
  }

  for (const event of incoming) {
    const existingId =
      (event.id && byId.has(event.id) ? event.id : undefined) ||
      (event.elementKey ? byKey.get(event.elementKey) : undefined);

    if (existingId) {
      const prior = byId.get(existingId);
      byId.delete(existingId);
      if (prior?.elementKey) byKey.delete(prior.elementKey);
    }

    byId.set(event.id, event);
    if (event.elementKey) byKey.set(event.elementKey, event.id);
  }

  return sortInputEventsChronological([...byId.values()]);
}

export function extractInputEvents(session: Record<string, unknown>): ApplicationQaInputEvent[] {
  const rawList = Array.isArray(session.inputEvents)
    ? session.inputEvents
    : Array.isArray(session.input_events)
      ? session.input_events
      : Array.isArray(session.questionsAnswers)
        ? session.questionsAnswers
        : Array.isArray(session.questions_answers)
          ? session.questions_answers
          : Array.isArray(session.items)
            ? session.items
            : Array.isArray(session.qa)
              ? session.qa
              : [];

  const events = rawList
    .map((row, index) => normalizeInputEvent(row, index))
    .filter((item): item is ApplicationQaInputEvent => Boolean(item));

  return sortInputEventsChronological(events);
}

function inputEventsToQaItems(events: ApplicationQaInputEvent[]): ApplicationQaItem[] {
  return events.map((event) => ({
    id: event.id,
    question: event.label || event.elementKey || event.cssSelector || "(element)",
    answer: event.value,
    updatedAt: event.updatedAt || event.occurredAt || undefined,
  }));
}

/** Element column: tag + type + #id / [name] / cssSelector (no truncation). */
export function formatInputEventElement(event: ApplicationQaInputEvent): string {
  const parts: string[] = [];
  if (event.tagName?.trim()) parts.push(event.tagName.trim().toLowerCase());
  if (event.inputType?.trim()) parts.push(event.inputType.trim());
  if (event.elementId?.trim()) parts.push(`#${event.elementId.trim()}`);
  if (event.name?.trim()) parts.push(`[name=${event.name.trim()}]`);
  if (event.cssSelector?.trim()) parts.push(event.cssSelector.trim());
  if (parts.length) return parts.join(" ");
  if (event.label?.trim()) return event.label.trim();
  if (event.elementKey?.trim()) return event.elementKey.trim();
  return "—";
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

/** Best-effort company label for session list cards. */
export function resolveApplicationQaCompanyName(
  session: Pick<ApplicationQaSessionSummary, "companyName" | "pageTitle" | "tabUrl">
): string {
  if (session.companyName?.trim()) return session.companyName.trim();

  const title = session.pageTitle?.trim() || "";
  const atMatch = title.match(/\s+@\s+(.+)$/);
  if (atMatch?.[1]?.trim()) return atMatch[1].trim();

  const dashMatch = title.match(/\s+[—–-]\s+(.+)$/);
  if (dashMatch?.[1]?.trim() && !dashMatch[1].includes("@")) {
    return dashMatch[1].trim();
  }

  try {
    const host = new URL(session.tabUrl).hostname.replace(/^www\./i, "");
    if (host) return host;
  } catch {
    // ignore
  }

  return title || "Application";
}

export function sessionActivityIso(
  session: Pick<ApplicationQaSessionSummary, "lastSyncedAt" | "updatedAt" | "createdAt">
): string {
  return session.lastSyncedAt || session.updatedAt || session.createdAt || "";
}

/** Parse SSE / detail session blob (summary + DOM input events). */
export function parseApplicationQaSessionPayload(
  raw: unknown
): ApplicationQaSessionDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const summary = normalizeSessionSummary(row);
  if (!summary) return null;
  const inputEvents = extractInputEvents(row);
  const eventCount = Math.max(summary.eventCount, inputEvents.length);
  return {
    ...summary,
    eventCount,
    itemCount: eventCount,
    inputEvents,
    questionsAnswers: inputEventsToQaItems(inputEvents),
  };
}

export type ApplicationQaLiveEvent =
  | { kind: "ready"; at?: string }
  | { kind: "session.created"; at?: string; session: ApplicationQaSessionDetail }
  | { kind: "session.updated"; at?: string; session: ApplicationQaSessionDetail }
  | { kind: "session.deleted"; at?: string; sessionId: string; userId?: string };

export function parseApplicationQaLiveEvent(
  eventName: string,
  data: unknown
): ApplicationQaLiveEvent | null {
  const row =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const at = pickString(row, "at") || undefined;
  // Prefer payload.type (default SSE data frames); fall back to named event.
  const type =
    pickString(row, "type") ||
    (eventName && eventName !== "message" ? eventName.trim() : "");

  if (type === "ready") {
    return { kind: "ready", at };
  }

  if (type === "session.created" || type === "session.updated") {
    const sessionRaw = row.session ?? row;
    const session = parseApplicationQaSessionPayload(sessionRaw);
    if (!session) return null;
    return {
      kind: type,
      at,
      session,
    };
  }

  if (type === "session.deleted") {
    const sessionId =
      pickString(row, "sessionId", "session_id", "id") ||
      (row.session && typeof row.session === "object"
        ? pickString(row.session as Record<string, unknown>, "id", "_id")
        : "");
    if (!sessionId) return null;
    return {
      kind: "session.deleted",
      at,
      sessionId,
      userId: pickString(row, "userId", "user_id") || undefined,
    };
  }

  return null;
}

/** Build SSE URL on the API origin (never a buffering Next/BFF proxy). */
export function buildApplicationQaStreamUrl(accessToken?: string | null): string {
  const base = `${API_BASE_URL}/admin/application-qa/stream`;
  const token = accessToken?.trim();
  if (!token) return base;
  const params = new URLSearchParams();
  params.set("access_token", token);
  params.set("token", token);
  return `${base}?${params.toString()}`;
}

export type ApplicationQaStreamTicket = {
  ticket: string;
  expiresIn?: number;
  streamPath: string;
};

/**
 * Mint a short-lived SSE ticket using the same cookie/Bearer auth as other /admin calls.
 * EventSource cannot set Authorization; ticket goes in the stream URL instead.
 */
export async function createApplicationQaStreamTicket(): Promise<ApplicationQaStreamTicket> {
  const data = await adminJson("/admin/application-qa/stream-ticket", {
    method: "POST",
  });
  const ticket =
    pickString(data, "ticket", "streamTicket", "stream_ticket", "token") || "";
  const streamPath =
    pickString(data, "streamPath", "stream_path", "path", "url") ||
    "/admin/application-qa/stream";
  if (!ticket) {
    throw new ApiError("Stream ticket missing from response.", 502);
  }
  const path = streamPath.startsWith("http")
    ? streamPath
    : streamPath.startsWith("/")
      ? `${API_BASE_URL}${streamPath}`
      : `${API_BASE_URL}/${streamPath}`;
  const joiner = path.includes("?") ? "&" : "?";
  return {
    ticket,
    expiresIn: toNumber(data.expiresIn ?? data.expires_in, 0) || undefined,
    streamPath: `${path}${joiner}ticket=${encodeURIComponent(ticket)}&access_token=${encodeURIComponent(ticket)}&token=${encodeURIComponent(ticket)}`,
  };
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
    /** Eastern calendar day `YYYY-MM-DD` (preferred when backend supports it). */
    date?: string;
    from?: string;
    to?: string;
    timezone?: string;
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
    if (params.date?.trim()) {
      search.set("date", params.date.trim());
      search.set("day", params.date.trim());
    }
    if (params.from?.trim()) search.set("from", params.from.trim());
    if (params.to?.trim()) search.set("to", params.to.trim());
    const tz = params.timezone?.trim() || "America/New_York";
    search.set("timezone", tz);
    search.set("tz", tz);

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
    const parsed = parseApplicationQaSessionPayload(nested);
    if (!parsed) throw new ApiError("Session payload was empty.", 502);
    return parsed;
  },

  async deleteSession(id: string): Promise<void> {
    const sid = id.trim();
    if (!sid) throw new ApiError("Missing session id.", 400);

    await adminJson(`/admin/application-qa/sessions/${encodeURIComponent(sid)}`, {
      method: "DELETE",
    });
  },
};
