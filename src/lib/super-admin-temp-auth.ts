/** Temporary Super Admin gate — replace with real role auth later. */
export const TEMP_SUPER_ADMIN_USERNAME = "qazwsx";
export const TEMP_SUPER_ADMIN_PASSWORD = "edcrfv";

const STORAGE_KEY = "dv21:super-admin-temp-auth:v1";

export function isTempSuperAdminAuthed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setTempSuperAdminAuthed(authed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (authed) sessionStorage.setItem(STORAGE_KEY, "1");
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function verifyTempSuperAdminCredentials(username: string, password: string): boolean {
  return (
    username.trim() === TEMP_SUPER_ADMIN_USERNAME && password === TEMP_SUPER_ADMIN_PASSWORD
  );
}
