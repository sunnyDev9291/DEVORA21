import { listSavedResumes } from "@/lib/saved-resumes-api";
import type { SavedResumeSearchFilters } from "@/lib/saved-resumes-api";
import type { SavedResumeArchive } from "@/lib/saved-resumes-types";

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  items: SavedResumeArchive[];
  fetchedAt: number;
};

let memoryCache: CacheEntry | null = null;
let inflight: Promise<SavedResumeArchive[]> | null = null;

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function peekCachedSavedResumes(): SavedResumeArchive[] | null {
  if (!memoryCache) return null;
  return memoryCache.items;
}

export function invalidateSavedResumesCache(): void {
  memoryCache = null;
}

function isFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

/**
 * Shared full-list fetch for Saved Resumes + today's count.
 * Dedupes concurrent callers and keeps an in-memory cache for the session.
 */
export async function listSavedResumesCached(options?: {
  force?: boolean;
}): Promise<SavedResumeArchive[]> {
  const force = Boolean(options?.force);

  if (!force && memoryCache && isFresh(memoryCache)) {
    return memoryCache.items;
  }

  if (!force && inflight) {
    return inflight;
  }

  const request = listSavedResumes()
    .then((items) => {
      memoryCache = { items, fetchedAt: Date.now() };
      return items;
    })
    .finally(() => {
      if (inflight === request) inflight = null;
    });

  inflight = request;
  return request;
}

function matchesText(haystack: string | undefined, needle: string): boolean {
  if (!needle) return true;
  return (haystack ?? "").toLowerCase().includes(needle.toLowerCase());
}

function bidLocalDateKey(bidAt: string): string | null {
  const date = new Date(bidAt);
  if (Number.isNaN(date.getTime())) return null;
  return localDateKey(date);
}

/** Client-side filter — avoids refetching the full archives list on every keystroke. */
export function filterSavedResumes(
  items: SavedResumeArchive[],
  filters: SavedResumeSearchFilters
): SavedResumeArchive[] {
  const company = filters.company?.trim() ?? "";
  const jobTitle = filters.jobTitle?.trim() ?? "";
  const jd = filters.jd?.trim() ?? "";
  const dateFrom = filters.dateFrom?.trim() ?? "";
  const dateTo = filters.dateTo?.trim() ?? "";

  if (!company && !jobTitle && !jd && !dateFrom && !dateTo) {
    return items;
  }

  return items.filter((item) => {
    if (!matchesText(item.companyName, company)) return false;
    if (!matchesText(item.jobTitle, jobTitle)) return false;
    if (!matchesText(item.jobDescription, jd)) return false;

    if (dateFrom || dateTo) {
      const dayKey = bidLocalDateKey(item.bidAt);
      if (!dayKey) return false;
      if (dateFrom && dayKey < dateFrom) return false;
      if (dateTo && dayKey > dateTo) return false;
    }

    return true;
  });
}
