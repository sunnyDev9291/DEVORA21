import { API_BASE_URL } from "@/lib/api-base-url";
import { apiAuthFetch } from "@/lib/api-auth";
import { ApiError } from "@/lib/auth-api";

/** Status of the signed-in Super Admin's operator gateway credentials. */
export type SuperAdminGatewayStatus = {
  configured: boolean;
  /** Present when configured — never includes the password. */
  username?: string;
  /** true when response came from local fallback (backend not deployed yet). */
  localFallback?: boolean;
};

export type SuperAdminGatewaySetPayload = {
  username: string;
  password: string;
  /** Required when credentials are already configured. */
  currentPassword?: string;
};

const LOCAL_PREFIX = "dv21:sa-gateway-creds:v1:";

type LocalCreds = { username: string; password: string };

function localKey(userId: string): string {
  return `${LOCAL_PREFIX}${userId.trim()}`;
}

function readLocalCreds(userId: string): LocalCreds | null {
  if (typeof window === "undefined" || !userId.trim()) return null;
  try {
    const raw = window.localStorage.getItem(localKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalCreds>;
    const username = typeof parsed.username === "string" ? parsed.username.trim() : "";
    const password = typeof parsed.password === "string" ? parsed.password : "";
    if (!username || !password) return null;
    return { username, password };
  } catch {
    return null;
  }
}

function writeLocalCreds(userId: string, creds: LocalCreds): void {
  if (typeof window === "undefined" || !userId.trim()) return;
  try {
    window.localStorage.setItem(localKey(userId), JSON.stringify(creds));
  } catch {
    // ignore quota
  }
}

function clearLocalCreds(userId: string): void {
  if (typeof window === "undefined" || !userId.trim()) return;
  try {
    window.localStorage.removeItem(localKey(userId));
  } catch {
    // ignore
  }
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

function errorMessage(data: Record<string, unknown>, fallback: string): string {
  if (typeof data.message === "string" && data.message.trim()) return data.message.trim();
  if (typeof data.error === "string" && data.error.trim()) return data.error.trim();
  return fallback;
}

function throwApi(res: Response, data: Record<string, unknown>, fallback: string): never {
  throw new ApiError(errorMessage(data, fallback), res.status, {
    message: errorMessage(data, fallback),
  });
}

function isMissingEndpoint(status: number): boolean {
  return status === 404 || status === 501;
}

export function validateGatewayUsername(username: string): string | null {
  const value = username.trim();
  if (value.length < 3) return "Username must be at least 3 characters.";
  if (value.length > 64) return "Username must be at most 64 characters.";
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
    return "Username may only use letters, numbers, dots, underscores, and hyphens.";
  }
  return null;
}

export function validateGatewayPassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 128) return "Password must be at most 128 characters.";
  return null;
}

/**
 * Per–Super Admin operator gateway credentials.
 * Prefers backend; falls back to user-scoped localStorage when the API is not deployed yet.
 */
export const superAdminGatewayApi = {
  async getStatus(userId: string): Promise<SuperAdminGatewayStatus> {
    const uid = userId.trim();
    if (!uid) {
      throw new ApiError("Sign in to Devora21 first.", 401);
    }

    try {
      const res = await apiAuthFetch(`${API_BASE_URL}/admin/gateway-credentials`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const data = await parseJson(res);

      if (res.ok) {
        const configured = Boolean(
          data.configured ?? data.isConfigured ?? data.hasCredentials
        );
        const username =
          (typeof data.username === "string" && data.username.trim()) ||
          (typeof data.operatorUsername === "string" && data.operatorUsername.trim()) ||
          undefined;
        // Backend is live — drop any local fallback copy.
        if (configured) clearLocalCreds(uid);
        return { configured, username, localFallback: false };
      }

      if (!isMissingEndpoint(res.status)) {
        throwApi(res, data, "Could not load gateway credentials.");
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      // Network / CORS — try local fallback below
    }

    const local = readLocalCreds(uid);
    return {
      configured: Boolean(local),
      username: local?.username,
      localFallback: true,
    };
  },

  async setCredentials(
    userId: string,
    payload: SuperAdminGatewaySetPayload,
    options?: { alreadyConfigured?: boolean }
  ): Promise<SuperAdminGatewayStatus> {
    const uid = userId.trim();
    if (!uid) throw new ApiError("Sign in to Devora21 first.", 401);

    const username = payload.username.trim();
    const password = payload.password;
    const currentPassword = payload.currentPassword;

    const userErr = validateGatewayUsername(username);
    if (userErr) throw new ApiError(userErr, 400);
    const passErr = validateGatewayPassword(password);
    if (passErr) throw new ApiError(passErr, 400);

    if (options?.alreadyConfigured) {
      if (!currentPassword) {
        throw new ApiError("Current password is required to change credentials.", 400);
      }
    }

    const body: Record<string, string> = { username, password };
    if (currentPassword) body.currentPassword = currentPassword;

    try {
      const res = await apiAuthFetch(`${API_BASE_URL}/admin/gateway-credentials`, {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await parseJson(res);

      if (res.ok) {
        clearLocalCreds(uid);
        return {
          configured: true,
          username:
            (typeof data.username === "string" && data.username.trim()) || username,
          localFallback: false,
        };
      }

      if (!isMissingEndpoint(res.status)) {
        throwApi(res, data, "Could not save gateway credentials.");
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
    }

    // Local fallback when backend endpoint is missing.
    if (options?.alreadyConfigured) {
      const existing = readLocalCreds(uid);
      if (!existing || existing.password !== currentPassword) {
        throw new ApiError("Current password is incorrect.", 401);
      }
    }
    writeLocalCreds(uid, { username, password });
    return { configured: true, username, localFallback: true };
  },

  async verify(
    userId: string,
    username: string,
    password: string
  ): Promise<{ ok: true; localFallback?: boolean }> {
    const uid = userId.trim();
    if (!uid) throw new ApiError("Sign in to Devora21 first.", 401);

    const user = username.trim();
    if (!user || !password) {
      throw new ApiError("Username and password are required.", 400);
    }

    try {
      const res = await apiAuthFetch(`${API_BASE_URL}/admin/gateway-credentials/verify`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: user, password }),
      });
      const data = await parseJson(res);

      if (res.ok) {
        return { ok: true, localFallback: false };
      }

      if (!isMissingEndpoint(res.status)) {
        throwApi(res, data, "Invalid username or password.");
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
    }

    const local = readLocalCreds(uid);
    if (!local || local.username !== user || local.password !== password) {
      throw new ApiError("Invalid username or password.", 401);
    }
    return { ok: true, localFallback: true };
  },
};
