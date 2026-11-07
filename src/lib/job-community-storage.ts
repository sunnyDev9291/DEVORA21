/** Job Community integration key (`bck_…`) — browser localStorage only, never the Devora user record. */

export const JOB_COMMUNITY_KEY_PREFIX = "bck_";
export const JOB_COMMUNITY_KEY_CHANGED_EVENT = "devora21-job-community-key-changed";
export const JOB_COMMUNITY_PROFILE_CHANGED_EVENT = "devora21-job-community-profile-changed";

const KEY_STORAGE = "devora21-job-community-integration-key";
const PROFILE_PREFIX = "devora21-job-community-profile-id:";

function profileStorageKey(userId: string): string {
  return `${PROFILE_PREFIX}${userId}`;
}

/** Normalize pasted key to `bck_…` form. */
export function normalizeIntegrationKey(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.toLowerCase().startsWith(JOB_COMMUNITY_KEY_PREFIX)) {
    return `${JOB_COMMUNITY_KEY_PREFIX}${trimmed.slice(JOB_COMMUNITY_KEY_PREFIX.length)}`;
  }
  return `${JOB_COMMUNITY_KEY_PREFIX}${trimmed}`;
}

export function isIntegrationKey(value: string | null | undefined): boolean {
  const key = (value ?? "").trim();
  return key.startsWith(JOB_COMMUNITY_KEY_PREFIX) && key.length > JOB_COMMUNITY_KEY_PREFIX.length;
}

export function getIntegrationKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(KEY_STORAGE)?.trim() || "";
    return isIntegrationKey(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function setIntegrationKey(raw: string): string {
  const key = normalizeIntegrationKey(raw);
  if (!isIntegrationKey(key)) {
    throw new Error("Integration key must start with bck_.");
  }
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY_STORAGE, key);
      window.dispatchEvent(new Event(JOB_COMMUNITY_KEY_CHANGED_EVENT));
    } catch {
      // ignore quota / privacy errors — still return key for this session call
    }
  }
  return key;
}

export function clearIntegrationKey(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY_STORAGE);
    window.dispatchEvent(new Event(JOB_COMMUNITY_KEY_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

export function getIntegrationKeyHeader(): Record<string, string> {
  const key = getIntegrationKey();
  if (!key) return {};
  return { "X-Integration-Key": key };
}

export function getDefaultJobCommunityProfileId(userId: string | undefined): string | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(profileStorageKey(userId))?.trim() || "";
    return stored || null;
  } catch {
    return null;
  }
}

export function setDefaultJobCommunityProfileId(userId: string, profileId: string): void {
  const id = profileId.trim();
  if (!userId || !id || typeof window === "undefined") return;
  try {
    localStorage.setItem(profileStorageKey(userId), id);
    window.dispatchEvent(new Event(JOB_COMMUNITY_PROFILE_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

export function clearDefaultJobCommunityProfileId(userId: string | undefined): void {
  if (!userId || typeof window === "undefined") return;
  try {
    localStorage.removeItem(profileStorageKey(userId));
    window.dispatchEvent(new Event(JOB_COMMUNITY_PROFILE_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

export function hasJobCommunityIntegrationKey(): boolean {
  return Boolean(getIntegrationKey());
}
