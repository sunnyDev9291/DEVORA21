import { API_BASE_URL } from "@/lib/api-base-url";
import { apiAuthFetch } from "@/lib/api-auth";
import { ApiError } from "@/lib/auth-api";
import type {
  ApplicationCaptureImage,
  ApplicationCaptureSession,
} from "@/lib/application-captures-api";

export type ApplicationCaptureOwner = {
  userId: string;
  email: string;
  name?: string;
  captureCount: number;
  lastCapturedAt?: string;
};

export type ApplicationCaptureSessionOwner = {
  userId: string;
  email: string;
  name?: string;
};

/** Super Admin session — includes owner across all users. */
export type AdminApplicationCaptureSession = ApplicationCaptureSession & {
  userId: string;
  owner?: ApplicationCaptureSessionOwner;
};

export type AdminApplicationCaptureListResponse = {
  sessions: AdminApplicationCaptureSession[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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

function parseImage(raw: unknown): ApplicationCaptureImage | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const imageUrl = pickString(row, "imageUrl", "image_url", "url");
  if (!imageUrl) return null;
  const id = pickString(row, "id");
  const sortOrder = toNumber(row.sortOrder ?? row.sort_order, 0);
  return {
    id: id || `${sortOrder}-${imageUrl.slice(-24)}`,
    sortOrder,
    imageUrl,
    width: toNumber(row.width, 0),
    height: toNumber(row.height, 0),
    ...(toNumber(row.byteSize ?? row.byte_size, 0)
      ? { byteSize: toNumber(row.byteSize ?? row.byte_size, 0) }
      : {}),
    ...(pickString(row, "createdAt", "created_at")
      ? { createdAt: pickString(row, "createdAt", "created_at") }
      : {}),
  };
}

function parseSessionOwner(raw: unknown): ApplicationCaptureSessionOwner | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Record<string, unknown>;
  const userId = pickString(row, "userId", "user_id", "id");
  const email = pickString(row, "email");
  const name = pickString(row, "name", "fullName", "full_name");
  if (!userId && !email && !name) return undefined;
  return {
    userId: userId || email,
    email,
    ...(name ? { name } : {}),
  };
}

export function parseAdminCaptureSession(raw: unknown): AdminApplicationCaptureSession | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = pickString(row, "id");
  if (!id) return null;

  const titleRaw = row.pageTitle ?? row.page_title ?? row.title;
  const pageTitle =
    typeof titleRaw === "string" && titleRaw.trim() ? titleRaw.trim() : null;

  const imagesRaw = Array.isArray(row.images) ? row.images : [];
  const images = imagesRaw
    .map(parseImage)
    .filter((img): img is ApplicationCaptureImage => Boolean(img))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const owner = parseSessionOwner(row.owner);
  const userId =
    pickString(row, "userId", "user_id") || owner?.userId || "";

  return {
    id,
    userId,
    ...(pickString(row, "clientCaptureId", "client_capture_id")
      ? { clientCaptureId: pickString(row, "clientCaptureId", "client_capture_id") }
      : {}),
    tabUrl: pickString(row, "tabUrl", "tab_url", "url"),
    pageTitle,
    status: pickString(row, "status") || "uploaded",
    sliceCount: toNumber(row.sliceCount ?? row.slice_count, images.length),
    capturedAt:
      pickString(row, "capturedAt", "captured_at") ||
      pickString(row, "createdAt", "created_at"),
    ...(pickString(row, "createdAt", "created_at")
      ? { createdAt: pickString(row, "createdAt", "created_at") }
      : {}),
    ...(pickString(row, "updatedAt", "updated_at")
      ? { updatedAt: pickString(row, "updatedAt", "updated_at") }
      : {}),
    ...(owner ? { owner } : {}),
    images,
  };
}

function parseOwner(raw: unknown): ApplicationCaptureOwner | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const userId = pickString(row, "userId", "user_id", "id");
  if (!userId) return null;
  return {
    userId,
    email: pickString(row, "email"),
    name: pickString(row, "name", "fullName", "full_name") || undefined,
    captureCount: toNumber(row.captureCount ?? row.capture_count ?? row.count, 0),
    lastCapturedAt:
      pickString(row, "lastCapturedAt", "last_captured_at") || undefined,
  };
}

export function displayCaptureOwnerName(
  owner: Pick<ApplicationCaptureOwner, "name" | "email" | "userId"> | ApplicationCaptureSessionOwner
): string {
  if ("name" in owner && owner.name?.trim()) return owner.name.trim();
  if (owner.email?.trim()) return owner.email.trim();
  if ("userId" in owner && owner.userId) return owner.userId.slice(0, 8) + "…";
  return "Unknown owner";
}

export const superAdminApplicationCapturesApi = {
  async listOwners(): Promise<ApplicationCaptureOwner[]> {
    const data = await adminJson("/admin/application-captures/owners");
    const raw = Array.isArray(data.owners)
      ? data.owners
      : Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.data)
          ? data.data
          : [];
    return raw
      .map(parseOwner)
      .filter((owner): owner is ApplicationCaptureOwner => Boolean(owner))
      .sort((a, b) => {
        const byLast = (b.lastCapturedAt || "").localeCompare(a.lastCapturedAt || "");
        if (byLast) return byLast;
        return displayCaptureOwnerName(a).localeCompare(displayCaptureOwnerName(b));
      });
  },

  async listSessions(params: {
    userId?: string;
    q?: string;
    date?: string;
    timezone?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<AdminApplicationCaptureListResponse> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 25));
    const search = new URLSearchParams();
    search.set("page", String(page));
    search.set("limit", String(limit));
    if (params.userId?.trim()) search.set("userId", params.userId.trim());
    if (params.q?.trim()) search.set("q", params.q.trim());
    if (params.date?.trim()) search.set("date", params.date.trim());
    if (params.timezone?.trim()) search.set("timezone", params.timezone.trim());

    const data = await adminJson(`/admin/application-captures?${search.toString()}`);
    const sessionsRaw = Array.isArray(data.sessions)
      ? data.sessions
      : Array.isArray(data.items)
        ? data.items
        : [];

    const sessions = sessionsRaw
      .map(parseAdminCaptureSession)
      .filter((s): s is AdminApplicationCaptureSession => Boolean(s));

    const total = toNumber(data.total, sessions.length);
    const totalPages =
      toNumber(data.totalPages ?? data.total_pages, 0) ||
      Math.max(1, Math.ceil(total / limit));

    return {
      sessions,
      page: toNumber(data.page, page),
      limit: toNumber(data.limit, limit),
      total,
      totalPages,
    };
  },

  async getSession(id: string): Promise<AdminApplicationCaptureSession> {
    const sid = id.trim();
    if (!sid) throw new ApiError("Missing capture id.", 400);
    const data = await adminJson(`/admin/application-captures/${encodeURIComponent(sid)}`);
    const session = parseAdminCaptureSession(data.session ?? data);
    if (!session) throw new ApiError("Capture session not found.", 404, { message: "Capture session not found." });
    return session;
  },

  async deleteSession(id: string): Promise<void> {
    const sid = id.trim();
    if (!sid) throw new ApiError("Missing capture id.", 400);
    await adminJson(`/admin/application-captures/${encodeURIComponent(sid)}`, {
      method: "DELETE",
    });
  },

  /**
   * Delete one screenshot slice.
   * When the last image is removed the backend may soft-delete the session
   * (`sessionDeleted: true` or `session: null`).
   */
  async deleteImage(
    sessionId: string,
    imageId: string
  ): Promise<DeleteCaptureImageResult> {
    const sid = sessionId.trim();
    const iid = imageId.trim();
    if (!sid) throw new ApiError("Missing capture id.", 400);
    if (!iid) throw new ApiError("Missing image id.", 400);

    const data = await adminJson(
      `/admin/application-captures/${encodeURIComponent(sid)}/images/${encodeURIComponent(iid)}`,
      { method: "DELETE" }
    );

    const sessionDeleted =
      data.sessionDeleted === true ||
      data.session_deleted === true ||
      data.deletedSession === true ||
      data.session === null;

    if (sessionDeleted) {
      return { sessionDeleted: true, session: null };
    }

    const sessionRaw = data.session ?? data.capture ?? null;
    const session =
      sessionRaw && typeof sessionRaw === "object"
        ? parseAdminCaptureSession(sessionRaw)
        : null;

    if (session) {
      return { sessionDeleted: false, session };
    }

    // No session payload — treat as image-only delete; caller removes locally.
    return { sessionDeleted: false, session: null };
  },
};

export type DeleteCaptureImageResult = {
  sessionDeleted: boolean;
  session: AdminApplicationCaptureSession | null;
};

export function captureSessionActivityIso(
  session: Pick<AdminApplicationCaptureSession, "capturedAt" | "updatedAt" | "createdAt">
): string {
  return session.capturedAt || session.updatedAt || session.createdAt || "";
}

export function sortCaptureSessionsRecent(
  sessions: AdminApplicationCaptureSession[]
): AdminApplicationCaptureSession[] {
  return [...sessions].sort((a, b) =>
    captureSessionActivityIso(b).localeCompare(captureSessionActivityIso(a))
  );
}

export function upsertCaptureSessionList(
  prev: AdminApplicationCaptureSession[],
  session: AdminApplicationCaptureSession
): AdminApplicationCaptureSession[] {
  const without = prev.filter((s) => s.id !== session.id);
  return sortCaptureSessionsRecent([session, ...without]);
}

/** Merge SSE/REST snapshots without wiping images when the payload is sparse. */
export function mergeCaptureSession(
  prev: AdminApplicationCaptureSession | null | undefined,
  incoming: AdminApplicationCaptureSession
): AdminApplicationCaptureSession {
  if (!prev || prev.id !== incoming.id) return incoming;
  // Keep prior images only when the update is summary-only (sliceCount > 0, no rows).
  const images =
    incoming.images.length > 0 || incoming.sliceCount === 0
      ? incoming.images
      : prev.images;
  return {
    ...prev,
    ...incoming,
    images,
    sliceCount:
      incoming.images.length > 0 || incoming.sliceCount === 0
        ? Math.max(incoming.sliceCount, images.length)
        : Math.max(incoming.sliceCount, images.length, prev.sliceCount),
    owner: incoming.owner ?? prev.owner,
    pageTitle: incoming.pageTitle ?? prev.pageTitle,
  };
}

/** Remove one image from a session snapshot; returns null if nothing left. */
export function removeCaptureImageFromSession(
  session: AdminApplicationCaptureSession,
  imageId: string
): AdminApplicationCaptureSession | null {
  const images = session.images
    .filter((img) => img.id !== imageId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (images.length === 0) return null;
  return {
    ...session,
    images,
    sliceCount: images.length,
  };
}

/** After deleting the image at `deletedIndex`, stay on nearest remaining slice. */
export function nearestLightboxIndex(
  deletedIndex: number,
  remainingCount: number
): number | null {
  if (remainingCount <= 0) return null;
  if (deletedIndex < 0) return 0;
  return Math.min(deletedIndex, remainingCount - 1);
}

export type ApplicationCapturesLiveEvent =
  | { kind: "ready"; at?: string }
  | { kind: "session.created"; at?: string; session: AdminApplicationCaptureSession }
  | { kind: "session.updated"; at?: string; session: AdminApplicationCaptureSession }
  | { kind: "session.deleted"; at?: string; sessionId: string; userId?: string }
  | {
      kind: "image.deleted";
      at?: string;
      sessionId: string;
      imageId: string;
      userId?: string;
      /** Present when backend also sends the remaining session (or null if session gone). */
      session?: AdminApplicationCaptureSession | null;
      sessionDeleted?: boolean;
    };

export function parseApplicationCapturesLiveEvent(
  eventName: string,
  data: unknown
): ApplicationCapturesLiveEvent | null {
  const row =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const at = pickString(row, "at") || undefined;
  const type =
    pickString(row, "type") ||
    (eventName && eventName !== "message" ? eventName.trim() : "");

  if (type === "ready") {
    return { kind: "ready", at };
  }

  if (type === "session.created" || type === "session.updated") {
    const session = parseAdminCaptureSession(row.session ?? row);
    if (!session) return null;
    return { kind: type, at, session };
  }

  if (type === "session.deleted") {
    const sessionId =
      pickString(row, "sessionId", "session_id", "id") ||
      (row.session && typeof row.session === "object"
        ? pickString(row.session as Record<string, unknown>, "id")
        : "");
    if (!sessionId) return null;
    const userId =
      pickString(row, "userId", "user_id") ||
      (row.session && typeof row.session === "object"
        ? pickString(row.session as Record<string, unknown>, "userId", "user_id")
        : "") ||
      undefined;
    return { kind: "session.deleted", at, sessionId, ...(userId ? { userId } : {}) };
  }

  if (type === "image.deleted") {
    const sessionId =
      pickString(row, "sessionId", "session_id") ||
      (row.session && typeof row.session === "object"
        ? pickString(row.session as Record<string, unknown>, "id")
        : "");
    const imageId =
      pickString(row, "imageId", "image_id", "id") ||
      (row.image && typeof row.image === "object"
        ? pickString(row.image as Record<string, unknown>, "id")
        : "");
    if (!sessionId || !imageId) return null;
    const userId = pickString(row, "userId", "user_id") || undefined;
    const sessionDeleted =
      row.sessionDeleted === true ||
      row.session_deleted === true ||
      row.session === null;
    let session: AdminApplicationCaptureSession | null | undefined;
    if (sessionDeleted) {
      session = null;
    } else if (row.session && typeof row.session === "object") {
      session = parseAdminCaptureSession(row.session);
    }
    return {
      kind: "image.deleted",
      at,
      sessionId,
      imageId,
      ...(userId ? { userId } : {}),
      ...(session !== undefined ? { session } : {}),
      ...(sessionDeleted ? { sessionDeleted: true } : {}),
    };
  }

  return null;
}

export type ApplicationCapturesStreamTicket = {
  ticket: string;
  expiresIn?: number;
  streamPath: string;
};

/**
 * Mint a short-lived SSE ticket using the same cookie/Bearer auth as other /admin calls.
 * EventSource cannot set Authorization; ticket goes in the stream URL instead.
 */
export async function createApplicationCapturesStreamTicket(): Promise<ApplicationCapturesStreamTicket> {
  const data = await adminJson("/admin/application-captures/stream-ticket", {
    method: "POST",
  });
  const ticket =
    pickString(data, "ticket", "streamTicket", "stream_ticket", "token") || "";
  const streamPath =
    pickString(data, "streamPath", "stream_path", "path", "url") ||
    "/admin/application-captures/stream";
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
