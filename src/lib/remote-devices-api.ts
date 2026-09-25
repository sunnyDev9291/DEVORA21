import { API_BASE_URL } from "@/lib/api-base-url";
import { apiAuthFetch } from "@/lib/api-auth";
import { ApiError, getApiErrorMessage } from "@/lib/auth-api";
import { downloadBlob } from "@/lib/saved-resumes-api";
import { RESUME_BUILDER_ACCESS_MESSAGE } from "@/lib/resume-access";
import { getUserApiKey } from "@/lib/user-api-key";

export type RemoteDevice = {
  id: string;
  name: string;
  secretPrefix: string;
  isDefault: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  revokedAt: string | null;
};

export type CreateRemoteDeviceResponse = {
  device: RemoteDevice;
  rawSecret: string;
  warning?: string;
};

export type ListRemoteDevicesResponse = {
  devices: RemoteDevice[];
};

export type ResumeDeliverMode = "here" | "remote";

export type ResumeDeliverHereResponse = {
  mode: "here";
  archiveId: string;
  resumeFileName?: string;
  pdfFileName?: string;
  pdfUrl?: string | null;
  docxUrl?: string | null;
};

export type ResumeDeliverRemoteResponse = {
  mode: "remote";
  deliveryId: string;
  deviceId: string;
  deviceName: string;
  archiveId: string;
  status: RemoteDeliveryStatus;
  expiresAt?: string;
};

export type ResumeDeliverResponse = ResumeDeliverHereResponse | ResumeDeliverRemoteResponse;

export type RemoteDeliveryStatus = "pending" | "claimed" | "delivered" | "failed" | "expired";

export type RemoteDelivery = {
  deliveryId: string;
  deviceId: string;
  deviceName: string;
  archiveId: string;
  status: RemoteDeliveryStatus;
  error?: string | null;
  deliveredAt?: string | null;
  expiresAt?: string | null;
};

export type DeliverResumeOptions = {
  mode: ResumeDeliverMode;
  deviceId?: string;
  includePdf?: boolean;
  includeDocx?: boolean;
};

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function authError(status: number, fallback: string): ApiError {
  if (status === 401) {
    return new ApiError(
      getUserApiKey()
        ? "Authentication failed. Reconnect your dv21_ API key and try again."
        : "Authentication required. Sign in or connect a dv21_ API key, then try again.",
      401
    );
  }
  if (status === 403) {
    return new ApiError(RESUME_BUILDER_ACCESS_MESSAGE, 403);
  }
  return new ApiError(fallback, status);
}

async function remoteRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
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

function parseDevice(raw: unknown): RemoteDevice | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== "string" || !obj.id.trim()) return null;
  return {
    id: obj.id,
    name: typeof obj.name === "string" ? obj.name : "Remote PC",
    secretPrefix: typeof obj.secretPrefix === "string" ? obj.secretPrefix : "",
    isDefault: Boolean(obj.isDefault),
    lastSeenAt: typeof obj.lastSeenAt === "string" ? obj.lastSeenAt : null,
    createdAt: typeof obj.createdAt === "string" ? obj.createdAt : "",
    revokedAt: typeof obj.revokedAt === "string" ? obj.revokedAt : null,
  };
}

export const remoteDevicesApi = {
  list: async (): Promise<RemoteDevice[]> => {
    const data = await remoteRequest<ListRemoteDevicesResponse>("/resume/remote-devices");
    const devices = Array.isArray(data.devices) ? data.devices : [];
    return devices
      .map(parseDevice)
      .filter((d): d is RemoteDevice => d !== null)
      .sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });
  },

  create: async (name: string, setDefault = true): Promise<CreateRemoteDeviceResponse> => {
    const data = await remoteRequest<CreateRemoteDeviceResponse>("/resume/remote-devices", {
      method: "POST",
      body: JSON.stringify({
        name: name.trim() || "Remote PC",
        setDefault,
      }),
    });
    const device = parseDevice(data.device);
    if (!device || typeof data.rawSecret !== "string" || !data.rawSecret.trim()) {
      throw new ApiError("Backend did not return a device secret.", 502);
    }
    return {
      device,
      rawSecret: data.rawSecret,
      warning: data.warning,
    };
  },

  setDefault: async (id: string): Promise<RemoteDevice> => {
    const data = await remoteRequest<{ device: RemoteDevice }>(
      `/resume/remote-devices/${encodeURIComponent(id)}/default`,
      { method: "POST" }
    );
    const device = parseDevice(data.device);
    if (!device) throw new ApiError("Backend did not return the updated device.", 502);
    return device;
  },

  revoke: async (id: string): Promise<RemoteDevice | null> => {
    const data = await remoteRequest<{ device?: RemoteDevice }>(
      `/resume/remote-devices/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    return parseDevice(data.device);
  },
};

export async function deliverResumeArchive(
  archiveId: string,
  options: DeliverResumeOptions
): Promise<ResumeDeliverResponse> {
  const id = archiveId.trim();
  if (!id) throw new ApiError("Missing archive id.", 400);

  const includePdf = options.includePdf !== false;
  const includeDocx = options.includeDocx !== false;
  if (!includePdf && !includeDocx) {
    throw new ApiError("Select at least one file format (PDF or DOCX).", 400);
  }

  const body: Record<string, unknown> = {
    mode: options.mode,
    includePdf,
    includeDocx,
  };
  if (options.mode === "remote" && options.deviceId?.trim()) {
    body.deviceId = options.deviceId.trim();
  }

  const res = await apiAuthFetch(
    `${API_BASE_URL}/resume/archives/${encodeURIComponent(id)}/deliver`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await parseJson<
    ResumeDeliverResponse & { message?: string; error?: string }
  >(res);

  if (!res.ok) {
    throw authError(
      res.status,
      data?.error || data?.message || `Deliver failed (${res.status}).`
    );
  }

  if (!data || (data.mode !== "here" && data.mode !== "remote")) {
    throw new ApiError("Unexpected deliver response.", 502);
  }

  return data;
}

export async function getRemoteDelivery(deliveryId: string): Promise<RemoteDelivery> {
  const data = await remoteRequest<{ delivery: RemoteDelivery }>(
    `/resume/remote-deliveries/${encodeURIComponent(deliveryId)}`
  );
  if (!data.delivery?.deliveryId) {
    throw new ApiError("Delivery not found.", 404);
  }
  return data.delivery;
}

/** Resolve deliver file URLs and trigger browser downloads (Here mode only). */
export async function downloadDeliverFiles(result: ResumeDeliverHereResponse): Promise<void> {
  const tasks: Array<Promise<void>> = [];

  if (result.pdfUrl) {
    tasks.push(
      downloadFromUrl(
        result.pdfUrl,
        result.pdfFileName?.trim() || "resume.pdf"
      )
    );
  }
  if (result.docxUrl) {
    tasks.push(
      downloadFromUrl(
        result.docxUrl,
        result.resumeFileName?.trim() || "resume.docx"
      )
    );
  }

  if (tasks.length === 0) {
    throw new ApiError("No download URLs returned for this archive.", 502);
  }

  await Promise.all(tasks);
}

async function downloadFromUrl(url: string, fileName: string): Promise<void> {
  const absolute = resolveDeliverFileUrl(url);
  const useAuth = absolute.startsWith(API_BASE_URL);
  const res = useAuth
    ? await apiAuthFetch(absolute, { method: "GET" })
    : await fetch(absolute);

  if (!res.ok) {
    throw authError(res.status, `Could not download ${fileName} (${res.status}).`);
  }

  const blob = await res.blob();
  downloadBlob(blob, fileName);
}

function resolveDeliverFileUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return `${API_BASE_URL}${trimmed}`;
  return `${API_BASE_URL}/${trimmed}`;
}

export function isRemoteDeliveryTerminal(status: RemoteDeliveryStatus): boolean {
  return status === "delivered" || status === "failed" || status === "expired";
}
