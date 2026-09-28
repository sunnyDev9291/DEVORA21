const STORAGE_KEY = "dv21:smart-cursor-enabled";
export const SMART_CURSOR_CHANGE_EVENT = "dv21:smart-cursor-change";

export function readSmartCursorEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true;
    return raw !== "0" && raw !== "false";
  } catch {
    return true;
  }
}

export function writeSmartCursorEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
  window.dispatchEvent(
    new CustomEvent(SMART_CURSOR_CHANGE_EVENT, { detail: { enabled } })
  );
}

export function toggleSmartCursorEnabled(): boolean {
  const next = !readSmartCursorEnabled();
  writeSmartCursorEnabled(next);
  return next;
}
