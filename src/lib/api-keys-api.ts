import { API_BASE_URL } from "@/lib/api-base-url";
import { ApiError, getApiErrorMessage } from "@/lib/auth-api";

export type UserApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
};

export type CreateApiKeyResponse = {
  apiKey: UserApiKey;
  rawKey: string;
  warning?: string;
};

export type ListApiKeysResponse = {
  apiKeys: UserApiKey[];
};

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function apiKeysRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const data = await parseJson<T & { message?: string; error?: string; errors?: Record<string, string[]> }>(res);

  if (!res.ok) {
    const message = getApiErrorMessage(data ?? { message: undefined }, "Request failed");
    throw new ApiError(message, res.status, {
      message,
      errors: data && "errors" in data ? data.errors : undefined,
    });
  }

  return data as T;
}

export const apiKeysApi = {
  list: () => apiKeysRequest<ListApiKeysResponse>("/auth/api-keys"),

  create: (name: string) =>
    apiKeysRequest<CreateApiKeyResponse>("/auth/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: name.trim() || "API key" }),
    }),

  revoke: (id: string) =>
    apiKeysRequest<{ ok?: boolean; message?: string }>(`/auth/api-keys/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};
