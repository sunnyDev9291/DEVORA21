import { LEGACY_TEMPLATE_STORAGE_KEY } from "@/lib/user-profile";

const PROFILE_PREFIX = "devora21-user-profile:";

/** Remove client-side auth and cached user data (not API cookies — use authApi.logout for those). */
export function clearAuthClientStorage(userId?: string): void {
  if (typeof window === "undefined") return;

  try {
    if (userId) {
      localStorage.removeItem(`${PROFILE_PREFIX}${userId}`);
    } else {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(PROFILE_PREFIX)) keys.push(key);
      }
      keys.forEach((key) => localStorage.removeItem(key));
    }
  } catch {
    // ignore quota / privacy errors
  }

  try {
    sessionStorage.removeItem(LEGACY_TEMPLATE_STORAGE_KEY);
  } catch {
    // ignore
  }
}
