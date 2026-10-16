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
  /** DeepSeek-matched Q&A count when backend provides it. */
  matchedCount?: number;
  /** Unmatched DOM event count when backend provides it. */
  unmatchedCount?: number;
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
  /** User action: input | change | click | … */
  actionType?: string;
  /** Control kind: text | radio | checkbox | yesno | dropdown | … */
  componentType?: string;
  tagName?: string;
  inputType?: string;
  elementId?: string;
  name?: string;
  className?: string;
  cssSelector?: string;
  attributes?: Record<string, string>;
  /** Short element summary — not a scraped/invented "question". */
  label?: string;
  elementLabel?: string;
  matchStatus?: "matched" | "unmatched";
  matchedQuestion?: string;
  /** AI question when matched; do not treat as element label. */
  question?: string;
  answer?: string;
  matchConfidence?: number;
  occurredAt: string;
  updatedAt: string;
};

/** DeepSeek-identified application question + user answer. */
export type ApplicationQaMatchedItem = {
  id: string;
  elementKey: string;
  /** DeepSeek question — never invent on the FE. */
  question: string;
  answer: string;
  actionType?: string;
  componentType?: string;
  matchConfidence?: number;
  matchStatus?: "matched";
  occurredAt: string;
  updatedAt: string;
};

/** DOM control the AI could not confidently map — never invent a question. */
export type ApplicationQaUnmatchedEvent = ApplicationQaInputEvent & {
  matchStatus: "unmatched";
};

/** @deprecated Compat shape; prefer matchedQa / unmatchedEvents. */
export type ApplicationQaItem = {
  id?: string;
  question: string;
  answer: string;
  updatedAt?: string;
};

export type ApplicationQaSessionDetail = ApplicationQaSessionSummary & {
  inputEvents: ApplicationQaInputEvent[];
  matchedQa: ApplicationQaMatchedItem[];
  unmatchedEvents: ApplicationQaUnmatchedEvent[];
  /** Compat alias — prefers matched rows when any exist. */
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
  const matchedCountRaw = row.matchedCount ?? row.matched_count;
  const unmatchedCountRaw = row.unmatchedCount ?? row.unmatched_count;
  const matchedCount =
    matchedCountRaw !== undefined && matchedCountRaw !== null
      ? toNumber(matchedCountRaw, 0)
      : undefined;
  const unmatchedCount =
    unmatchedCountRaw !== undefined && unmatchedCountRaw !== null
      ? toNumber(unmatchedCountRaw, 0)
      : undefined;
  const eventCount = toNumber(
    row.eventCount ??
      row.event_count ??
      (matchedCount !== undefined || unmatchedCount !== undefined
        ? (matchedCount ?? 0) + (unmatchedCount ?? 0)
        : undefined) ??
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
    matchedCount,
    unmatchedCount,
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

function normalizeMatchStatus(raw: unknown): "matched" | "unmatched" | undefined {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (value === "matched" || value === "unmatched") return value;
  return undefined;
}

function normalizeConfidence(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() && !Number.isNaN(Number(raw))) {
    return Number(raw);
  }
  return undefined;
}

function ownArray(
  row: Record<string, unknown>,
  ...keys: string[]
): unknown[] | null {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && Array.isArray(row[key])) {
      return row[key] as unknown[];
    }
  }
  return null;
}

function normalizeInputEvent(raw: unknown, index = 0): ApplicationQaInputEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;

  const value =
    pickString(row, "value", "answer", "a", "response") ||
    (typeof row.value === "number" || typeof row.value === "boolean"
      ? String(row.value)
      : "");
  // Element summary only — never treat AI question text as a label.
  const label =
    pickString(row, "label", "elementLabel", "element_label") || undefined;
  const question =
    pickString(row, "matchedQuestion", "matched_question", "question") || undefined;
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
  const matchStatus = normalizeMatchStatus(row.matchStatus ?? row.match_status);

  if (
    !value &&
    !label &&
    !question &&
    !elementKey &&
    !pickString(row, "tagName", "tag_name", "cssSelector", "css_selector")
  ) {
    return null;
  }

  return {
    id,
    elementKey: elementKey || id,
    value,
    eventType: pickString(row, "eventType", "event_type") || undefined,
    actionType:
      pickString(row, "actionType", "action_type") ||
      pickString(row, "eventType", "event_type") ||
      undefined,
    componentType: pickString(row, "componentType", "component_type") || undefined,
    tagName: pickString(row, "tagName", "tag_name", "tag") || undefined,
    inputType: pickString(row, "inputType", "input_type") || undefined,
    elementId: pickString(row, "elementId", "element_id") || undefined,
    name: pickString(row, "name") || undefined,
    className: pickString(row, "className", "class_name", "class") || undefined,
    cssSelector: pickString(row, "cssSelector", "css_selector", "selector") || undefined,
    attributes: normalizeAttributes(row.attributes),
    label,
    elementLabel: pickString(row, "elementLabel", "element_label") || label || undefined,
    matchStatus,
    matchedQuestion: pickString(row, "matchedQuestion", "matched_question") || undefined,
    question,
    answer: pickString(row, "answer") || value || undefined,
    matchConfidence: normalizeConfidence(
      row.matchConfidence ?? row.match_confidence ?? row.confidence
    ),
    occurredAt,
    updatedAt,
  };
}

function normalizeMatchedItem(raw: unknown, index = 0): ApplicationQaMatchedItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  // Only show DeepSeek/API question text — never invent a placeholder.
  const question =
    pickString(row, "question", "matchedQuestion", "matched_question") || "";
  if (!question) return null;
  const answer =
    pickString(row, "answer", "value", "a", "response") ||
    (typeof row.value === "number" || typeof row.value === "boolean"
      ? String(row.value)
      : "");
  const elementKey =
    pickString(row, "elementKey", "element_key", "key") ||
    pickString(row, "id", "_id") ||
    "";
  const id =
    pickString(row, "id", "_id") ||
    (elementKey ? `matched:${elementKey}` : "") ||
    `matched-${index}`;
  const occurredAt =
    pickString(row, "occurredAt", "occurred_at", "updatedAt", "updated_at") || "";
  const updatedAt =
    pickString(row, "updatedAt", "updated_at", "occurredAt", "occurred_at") || occurredAt;
  return {
    id,
    elementKey: elementKey || id,
    question,
    answer,
    actionType:
      pickString(row, "actionType", "action_type") ||
      pickString(row, "eventType", "event_type") ||
      undefined,
    componentType: pickString(row, "componentType", "component_type") || undefined,
    matchConfidence: normalizeConfidence(
      row.matchConfidence ?? row.match_confidence ?? row.confidence
    ),
    matchStatus: "matched",
    occurredAt,
    updatedAt,
  };
}

function sortMatchedChronological(
  items: ApplicationQaMatchedItem[]
): ApplicationQaMatchedItem[] {
  return [...items].sort((a, b) => {
    const byTime = (a.occurredAt || a.updatedAt || "").localeCompare(
      b.occurredAt || b.updatedAt || ""
    );
    if (byTime) return byTime;
    return (a.id || "").localeCompare(b.id || "");
  });
}

function eventToMatchedItem(
  event: ApplicationQaInputEvent
): ApplicationQaMatchedItem | null {
  const question = (event.matchedQuestion || event.question || "").trim();
  if (!question) return null;
  return {
    id: event.id,
    elementKey: event.elementKey,
    question,
    answer: event.answer || event.value || "",
    actionType: event.actionType || event.eventType,
    componentType: event.componentType,
    matchConfidence: event.matchConfidence,
    matchStatus: "matched",
    occurredAt: event.occurredAt,
    updatedAt: event.updatedAt || event.occurredAt,
  };
}

/** One row per elementKey — keep the latest updatedAt (radio/checkbox re-types). */
function dedupeByElementKeyPreferLatest<
  T extends { id: string; elementKey: string; updatedAt: string; occurredAt: string }
>(items: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const item of items) {
    const key = item.elementKey || item.id;
    const prior = byKey.get(key);
    if (!prior) {
      byKey.set(key, item);
      continue;
    }
    const priorTs = prior.updatedAt || prior.occurredAt || "";
    const nextTs = item.updatedAt || item.occurredAt || "";
    if (nextTs.localeCompare(priorTs) >= 0) byKey.set(key, item);
  }
  return [...byKey.values()];
}

function eventToUnmatched(
  event: ApplicationQaInputEvent
): ApplicationQaUnmatchedEvent {
  return {
    ...event,
    matchStatus: "unmatched",
    // Never surface AI question text as an invented question on unmatched rows.
    question: undefined,
    matchedQuestion: undefined,
    label: event.label || event.elementLabel,
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

function upsertByIdOrElementKey<T extends { id: string; elementKey: string }>(
  prev: T[],
  incoming: T[],
  sortFn: (items: T[]) => T[]
): T[] {
  if (!incoming.length) return sortFn(prev);
  if (!prev.length) return sortFn(incoming);

  const byId = new Map<string, T>();
  const byKey = new Map<string, string>();

  for (const item of prev) {
    byId.set(item.id, item);
    if (item.elementKey) byKey.set(item.elementKey, item.id);
  }

  for (const item of incoming) {
    const existingId =
      (item.id && byId.has(item.id) ? item.id : undefined) ||
      (item.elementKey ? byKey.get(item.elementKey) : undefined);

    if (existingId) {
      const prior = byId.get(existingId);
      byId.delete(existingId);
      if (prior?.elementKey) byKey.delete(prior.elementKey);
    }

    byId.set(item.id, item);
    if (item.elementKey) byKey.set(item.elementKey, item.id);
  }

  return sortFn([...byId.values()]);
}

/** Upsert by id, then elementKey — unchanged re-types / radio groups stay one row. */
export function upsertInputEvents(
  prev: ApplicationQaInputEvent[],
  incoming: ApplicationQaInputEvent[]
): ApplicationQaInputEvent[] {
  return upsertByIdOrElementKey(prev, incoming, sortInputEventsChronological);
}

export function upsertMatchedQa(
  prev: ApplicationQaMatchedItem[],
  incoming: ApplicationQaMatchedItem[]
): ApplicationQaMatchedItem[] {
  return sortMatchedChronological(
    dedupeByElementKeyPreferLatest(
      upsertByIdOrElementKey(prev, incoming, (items) => items)
    )
  );
}

export function upsertUnmatchedEvents(
  prev: ApplicationQaUnmatchedEvent[],
  incoming: ApplicationQaUnmatchedEvent[]
): ApplicationQaUnmatchedEvent[] {
  return sortInputEventsChronological(
    dedupeByElementKeyPreferLatest(
      upsertByIdOrElementKey(prev, incoming, (items) => items)
    )
  ) as ApplicationQaUnmatchedEvent[];
}

export function extractInputEvents(session: Record<string, unknown>): ApplicationQaInputEvent[] {
  const preferred = ownArray(session, "inputEvents", "input_events");
  const rawList =
    preferred ??
    (Array.isArray(session.items)
      ? session.items
      : Array.isArray(session.qa)
        ? session.qa
        : []);

  // When preferred inputEvents is absent, do not steal questionsAnswers here —
  // those feed matchedQa for legacy payloads.
  const events = rawList
    .map((row, index) => normalizeInputEvent(row, index))
    .filter((item): item is ApplicationQaInputEvent => Boolean(item));

  return sortInputEventsChronological(events);
}

export function extractMatchedQa(
  session: Record<string, unknown>,
  inputEvents: ApplicationQaInputEvent[]
): ApplicationQaMatchedItem[] {
  const preferred = ownArray(session, "matchedQa", "matched_qa");
  if (preferred) {
    return sortMatchedChronological(
      dedupeByElementKeyPreferLatest(
        preferred
          .map((row, index) => normalizeMatchedItem(row, index))
          .filter((item): item is ApplicationQaMatchedItem => Boolean(item))
      )
    );
  }

  const fromEvents = inputEvents.filter((e) => e.matchStatus === "matched");
  if (fromEvents.length || inputEvents.some((e) => e.matchStatus)) {
    return sortMatchedChronological(
      dedupeByElementKeyPreferLatest(
        fromEvents
          .map(eventToMatchedItem)
          .filter((item): item is ApplicationQaMatchedItem => Boolean(item))
      )
    );
  }

  const legacyQa = ownArray(session, "questionsAnswers", "questions_answers");
  if (legacyQa) {
    return sortMatchedChronological(
      dedupeByElementKeyPreferLatest(
        legacyQa
          .map((row, index) => normalizeMatchedItem(row, index))
          .filter((item): item is ApplicationQaMatchedItem => Boolean(item))
      )
    );
  }

  return [];
}

export function extractUnmatchedEvents(
  session: Record<string, unknown>,
  inputEvents: ApplicationQaInputEvent[]
): ApplicationQaUnmatchedEvent[] {
  const preferred = ownArray(session, "unmatchedEvents", "unmatched_events");
  if (preferred) {
    return sortInputEventsChronological(
      dedupeByElementKeyPreferLatest(
        preferred
          .map((row, index) => {
            const event = normalizeInputEvent(row, index);
            return event ? eventToUnmatched(event) : null;
          })
          .filter((item): item is ApplicationQaUnmatchedEvent => Boolean(item))
      )
    ) as ApplicationQaUnmatchedEvent[];
  }

  if (inputEvents.some((e) => e.matchStatus === "matched" || e.matchStatus === "unmatched")) {
    return sortInputEventsChronological(
      dedupeByElementKeyPreferLatest(
        inputEvents.filter((e) => e.matchStatus === "unmatched").map(eventToUnmatched)
      )
    ) as ApplicationQaUnmatchedEvent[];
  }

  // No match split from backend — treat DOM events as unmatched (do not invent questions).
  const hasMatchedKey =
    Object.prototype.hasOwnProperty.call(session, "matchedQa") ||
    Object.prototype.hasOwnProperty.call(session, "matched_qa");
  if (!hasMatchedKey && inputEvents.length) {
    return sortInputEventsChronological(
      dedupeByElementKeyPreferLatest(inputEvents.map(eventToUnmatched))
    ) as ApplicationQaUnmatchedEvent[];
  }

  return [];
}

function matchedToQaItems(items: ApplicationQaMatchedItem[]): ApplicationQaItem[] {
  return items.map((item) => ({
    id: item.id,
    question: item.question,
    answer: item.answer,
    updatedAt: item.updatedAt || item.occurredAt || undefined,
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
  if (event.elementLabel?.trim()) return event.elementLabel.trim();
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

/** Parse SSE / detail session blob (matched Q&A + unmatched DOM events). */
export function parseApplicationQaSessionPayload(
  raw: unknown
): ApplicationQaSessionDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const summary = normalizeSessionSummary(row);
  if (!summary) return null;
  const inputEvents = extractInputEvents(row);
  const matchedQa = extractMatchedQa(row, inputEvents);
  const unmatchedEvents = extractUnmatchedEvents(row, inputEvents);
  const matchedCount = Math.max(summary.matchedCount ?? 0, matchedQa.length);
  const unmatchedCount = Math.max(summary.unmatchedCount ?? 0, unmatchedEvents.length);
  const eventCount = Math.max(
    summary.eventCount,
    inputEvents.length,
    matchedCount + unmatchedCount
  );
  return {
    ...summary,
    eventCount,
    itemCount: eventCount,
    matchedCount,
    unmatchedCount,
    inputEvents,
    matchedQa,
    unmatchedEvents,
    questionsAnswers: matchedToQaItems(matchedQa),
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
