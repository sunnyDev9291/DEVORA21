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

function parseSession(raw: unknown): AdminApplicationCaptureSession | null {
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

    const data = await adminJson(`/admin/application-captures?${search.toString()}`);
    const sessionsRaw = Array.isArray(data.sessions)
      ? data.sessions
      : Array.isArray(data.items)
        ? data.items
        : [];

    const sessions = sessionsRaw
      .map(parseSession)
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
    const session = parseSession(data.session ?? data);
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
};
