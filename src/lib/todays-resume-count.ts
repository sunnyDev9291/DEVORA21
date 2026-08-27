import { listSavedResumes } from "@/lib/saved-resumes-api";
import type { SavedResumeArchive } from "@/lib/saved-resumes-types";

/** Dispatched after a resume is archived so UI can refresh today's count. */
export const TODAYS_RESUME_COUNT_CHANGED_EVENT = "devora21-todays-resume-count-changed";

/** Local calendar day key, e.g. `2026-08-20`. */
export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isBidOnLocalDate(bidAt: string, localDateKey: string): boolean {
  const date = new Date(bidAt);
  if (Number.isNaN(date.getTime())) return false;
  return getLocalDateKey(date) === localDateKey;
}

export function countResumesOnLocalDate(
  items: SavedResumeArchive[],
  localDateKey: string = getLocalDateKey()
): number {
  return items.reduce((count, item) => count + (isBidOnLocalDate(item.bidAt, localDateKey) ? 1 : 0), 0);
}

/** Fetch archives and count how many fall on today's local calendar day. */
export async function fetchTodaysResumeCount(): Promise<number> {
  const today = getLocalDateKey();
  // Do not rely on backend from/to filters — they can disagree with local calendar days.
  // Pull the list and count bidAt in the user's local timezone.
  const items = await listSavedResumes();
  return countResumesOnLocalDate(items, today);
}

export function notifyTodaysResumeCountChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(TODAYS_RESUME_COUNT_CHANGED_EVENT));
}
