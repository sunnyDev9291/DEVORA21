const STORAGE_KEY = "devora21-user-api-key";
export const USER_API_KEY_PREFIX = "dv21_";
export const USER_API_KEY_CHANGED_EVENT = "devora21-user-api-key-changed";

/** Normalize pasted key to `dv21_…` form. */
export function normalizeUserApiKey(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.toLowerCase().startsWith(USER_API_KEY_PREFIX)) {
    return `${USER_API_KEY_PREFIX}${trimmed.slice(USER_API_KEY_PREFIX.length)}`;
  }
  return `${USER_API_KEY_PREFIX}${trimmed}`;
}

export function isUserApiKey(value: string | null | undefined): boolean {
  const key = (value ?? "").trim();
  return key.toLowerCase().startsWith(USER_API_KEY_PREFIX) && key.length > USER_API_KEY_PREFIX.length;
}

export function getUserApiKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)?.trim() || "";
    return isUserApiKey(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function setUserApiKey(raw: string): string {
  const key = normalizeUserApiKey(raw);
  if (!isUserApiKey(key)) {
    throw new Error("API key must start with dv21_.");
  }
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(STORAGE_KEY, key);
      window.dispatchEvent(new Event(USER_API_KEY_CHANGED_EVENT));
    } catch {
      // ignore quota / privacy errors — still return key for this session call
    }
  }
  return key;
}

export function clearUserApiKey(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(USER_API_KEY_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

export function getUserApiKeyAuthHeader(): Record<string, string> {
  const key = getUserApiKey();
  if (!key) return {};
  return { Authorization: `Bearer ${key}` };
}
