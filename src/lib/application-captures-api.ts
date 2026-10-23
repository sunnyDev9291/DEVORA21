import { API_BASE_URL } from "@/lib/api-base-url";
import { apiAuthFetch } from "@/lib/api-auth";
import { ApiError, getApiErrorMessage } from "@/lib/auth-api";

export type ApplicationCaptureImage = {
  id: string;
  sortOrder: number;
  imageUrl: string;
  width: number;
  height: number;
  byteSize?: number;
  createdAt?: string;
  /**
   * Super Admin review flag. `false` = unread/new.
   * Omitted/true = already reviewed (or legacy payload).
   */
  reviewed?: boolean;
};

export type ApplicationCaptureSession = {
  id: string;
  clientCaptureId?: string;
  tabUrl: string;
  /** Backend may return null when the tab had no document title. */
  pageTitle: string | null;
  status: string;
  sliceCount: number;
  /** Unreviewed screenshot count for Super Admin badges. */
  uncheckedCount?: number;
  capturedAt: string;
  createdAt?: string;
  updatedAt?: string;
  images: ApplicationCaptureImage[];
};

export type ApplicationCaptureListResponse = {
  sessions: ApplicationCaptureSession[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ApplicationCaptureDetailResponse = {
  session: ApplicationCaptureSession;
};

function pickString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickNumber(row: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return 0;
}

function parseImage(raw: unknown): ApplicationCaptureImage | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = pickString(row, "id");
  const imageUrl = pickString(row, "imageUrl", "image_url", "url");
  if (!imageUrl) return null;
  const reviewedRaw = row.reviewed ?? row.isReviewed ?? row.is_reviewed;
  const reviewed =
    typeof reviewedRaw === "boolean"
      ? reviewedRaw
      : reviewedRaw === "false" || reviewedRaw === 0
        ? false
        : reviewedRaw === "true" || reviewedRaw === 1
          ? true
          : undefined;

  return {
    id: id || `${pickNumber(row, "sortOrder", "sort_order")}-${imageUrl.slice(-24)}`,
    sortOrder: pickNumber(row, "sortOrder", "sort_order"),
    imageUrl,
    width: pickNumber(row, "width"),
    height: pickNumber(row, "height"),
    ...(pickNumber(row, "byteSize", "byte_size")
      ? { byteSize: pickNumber(row, "byteSize", "byte_size") }
      : {}),
    ...(pickString(row, "createdAt", "created_at")
      ? { createdAt: pickString(row, "createdAt", "created_at") }
      : {}),
    ...(reviewed === undefined ? {} : { reviewed }),
  };
}

function parseSession(raw: unknown): ApplicationCaptureSession | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = pickString(row, "id");
  if (!id) return null;

  const imagesRaw = Array.isArray(row.images) ? row.images : [];
  const images = imagesRaw
    .map(parseImage)
    .filter((img): img is ApplicationCaptureImage => Boolean(img))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const titleRaw = row.pageTitle ?? row.page_title ?? row.title;
  const pageTitle =
    typeof titleRaw === "string" && titleRaw.trim() ? titleRaw.trim() : null;

  return {
    id,
    ...(pickString(row, "clientCaptureId", "client_capture_id")
      ? { clientCaptureId: pickString(row, "clientCaptureId", "client_capture_id") }
      : {}),
    tabUrl: pickString(row, "tabUrl", "tab_url", "url"),
    pageTitle,
    status: pickString(row, "status") || "uploaded",
    sliceCount: pickNumber(row, "sliceCount", "slice_count") || images.length,
    ...(row.uncheckedCount != null || row.unchecked_count != null
      ? {
          uncheckedCount: pickNumber(row, "uncheckedCount", "unchecked_count"),
        }
      : {}),
    capturedAt:
      pickString(row, "capturedAt", "captured_at") ||
      pickString(row, "createdAt", "created_at"),
    ...(pickString(row, "createdAt", "created_at")
      ? { createdAt: pickString(row, "createdAt", "created_at") }
      : {}),
    ...(pickString(row, "updatedAt", "updated_at")
      ? { updatedAt: pickString(row, "updatedAt", "updated_at") }
      : {}),
    images,
  };
}

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function capturesRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiAuthFetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const data = await parseJson<
    T & { message?: string; error?: string; errors?: Record<string, string[]> }
  >(res);

  if (!res.ok) {
    const message = getApiErrorMessage(
      data ?? { message: undefined },
      `Request failed (${res.status}).`
    );
    throw new ApiError(message, res.status, {
      message,
      errors: data && "errors" in data ? data.errors : undefined,
    });
  }

  return data as T;
}

export async function listApplicationCaptures(params?: {
  page?: number;
  limit?: number;
}): Promise<ApplicationCaptureListResponse> {
  const page = Math.max(1, params?.page ?? 1);
  const limit = Math.min(100, Math.max(1, params?.limit ?? 20));
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  const data = await capturesRequest<Record<string, unknown>>(
    `/application-captures?${qs.toString()}`
  );

  const sessionsRaw = Array.isArray(data.sessions)
    ? data.sessions
    : Array.isArray(data.items)
      ? data.items
      : [];

  const sessions = sessionsRaw
    .map(parseSession)
    .filter((s): s is ApplicationCaptureSession => Boolean(s));

  const total = pickNumber(data, "total") || sessions.length;
  const totalPages =
    pickNumber(data, "totalPages", "total_pages") ||
    Math.max(1, Math.ceil(total / limit));

  return {
    sessions,
    page: pickNumber(data, "page") || page,
    limit: pickNumber(data, "limit") || limit,
    total,
    totalPages,
  };
}

export async function getApplicationCapture(
  id: string
): Promise<ApplicationCaptureSession> {
  const data = await capturesRequest<Record<string, unknown>>(
    `/application-captures/${encodeURIComponent(id)}`
  );
  const sessionRaw = data.session ?? data;
  const session = parseSession(sessionRaw);
  if (!session) {
    throw new ApiError("Capture session not found.", 404, { message: "Capture session not found." });
  }
  return session;
}

export async function deleteApplicationCapture(id: string): Promise<void> {
  await capturesRequest(`/application-captures/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function hostnameFromCaptureUrl(url: string): string {
  if (!url.trim()) return "Unknown host";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//i, "").split("/")[0] || url;
  }
}

/** Display label when pageTitle is null/empty. */
export function captureSessionTitle(
  session: Pick<ApplicationCaptureSession, "pageTitle" | "tabUrl">
): string {
  const title = session.pageTitle?.trim();
  if (title) return title;
  const host = hostnameFromCaptureUrl(session.tabUrl);
  return host !== "Unknown host" ? host : "Untitled page";
}

export function formatCaptureTime(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
