/**
 * Session unlock flag for the Super Admin UI gate.
 * Credentials live per Super Admin via superAdminGatewayApi (backend, with local fallback).
 */

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
