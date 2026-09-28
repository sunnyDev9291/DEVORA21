import type { DiscoveredJobRow, JobCrawlPlatform, JobCrawlResult } from "@/lib/builtin-crawl-types";
import { mergeListingUrls } from "@/lib/builtin-crawl-types";
import { flattenCrawlResults } from "@/lib/job-crawl-list";

const STORAGE_KEY = "dv21:job-discovery-crawl:v3";

function storageKeyForUser(userId?: string | null): string {
  const id = userId?.trim();
  return id ? `${STORAGE_KEY}:${id}` : STORAGE_KEY;
}

export type StoredJobCrawlDiff = {
  added: number;
  removed: number;
};

export type StoredJobCrawlSession = {
  selectedPlatforms: JobCrawlPlatform[];
  listingUrls: Record<JobCrawlPlatform, string>;
  jobs: DiscoveredJobRow[];
  savedAt: string;
  /** Jobs that appeared in the latest crawl vs the previous one. */
  newJobKeys?: string[];
  /** Latest crawl delta vs previous stored list. */
  lastDiff?: StoredJobCrawlDiff;
};

function isPlatform(value: unknown): value is JobCrawlPlatform {
  return (
    value === "builtin" ||
    value === "hiringcafe" ||
    value === "workable" ||
    value === "workingnomads" ||
    value === "himalayas" ||
    value === "getonboard" ||
    value === "jobicy"
  );
}

function parseJobRow(raw: unknown, index: number): DiscoveredJobRow | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!isPlatform(obj.platform)) return null;

  return {
    platform: obj.platform,
    jobId: typeof obj.jobId === "string" ? obj.jobId : String(index),
    companyName: typeof obj.companyName === "string" ? obj.companyName : "",
    jobTitle: typeof obj.jobTitle === "string" ? obj.jobTitle : "",
    jobUrl: typeof obj.jobUrl === "string" ? obj.jobUrl : "",
  };
}

function parseJobs(raw: unknown): DiscoveredJobRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => parseJobRow(item, index))
    .filter((row): row is DiscoveredJobRow => row !== null);
}

function parseListingUrls(raw: unknown): Record<JobCrawlPlatform, string> | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  return mergeListingUrls({
    builtin: typeof obj.builtin === "string" ? obj.builtin : "",
    hiringcafe: typeof obj.hiringcafe === "string" ? obj.hiringcafe : "",
    workable: typeof obj.workable === "string" ? obj.workable : "",
    workingnomads: typeof obj.workingnomads === "string" ? obj.workingnomads : "",
    himalayas: typeof obj.himalayas === "string" ? obj.himalayas : "",
    getonboard: typeof obj.getonboard === "string" ? obj.getonboard : "",
    jobicy: typeof obj.jobicy === "string" ? obj.jobicy : "",
  });
}

function parsePlatforms(raw: unknown): JobCrawlPlatform[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isPlatform);
}

function parseResult(raw: unknown): JobCrawlResult | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!isPlatform(obj.platform)) return null;
  if (!Array.isArray(obj.jobs)) return null;
  if (typeof obj.totalCount !== "number") return null;

  const jobs = obj.jobs
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item, index) => ({
      jobId: typeof item.jobId === "string" ? item.jobId : String(index),
      companyName: typeof item.companyName === "string" ? item.companyName : "",
      jobTitle: typeof item.jobTitle === "string" ? item.jobTitle : "",
      jobUrl: typeof item.jobUrl === "string" ? item.jobUrl : "",
    }));

  return {
    sourceUrl: typeof obj.sourceUrl === "string" ? obj.sourceUrl : "",
    platform: obj.platform,
    pagesScraped: typeof obj.pagesScraped === "number" ? obj.pagesScraped : undefined,
    totalCount: obj.totalCount,
    jobs,
  };
}

function parseResults(raw: unknown): Partial<Record<JobCrawlPlatform, JobCrawlResult>> {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const out: Partial<Record<JobCrawlPlatform, JobCrawlResult>> = {};

  if (obj.builtin) {
    const parsed = parseResult(obj.builtin);
    if (parsed) out.builtin = parsed;
  }
  if (obj.hiringcafe) {
    const parsed = parseResult(obj.hiringcafe);
    if (parsed) out.hiringcafe = parsed;
  }
  if (obj.workable) {
    const parsed = parseResult(obj.workable);
    if (parsed) out.workable = parsed;
  }
  if (obj.workingnomads) {
    const parsed = parseResult(obj.workingnomads);
    if (parsed) out.workingnomads = parsed;
  }
  if (obj.himalayas) {
    const parsed = parseResult(obj.himalayas);
    if (parsed) out.himalayas = parsed;
  }
  if (obj.getonboard) {
    const parsed = parseResult(obj.getonboard);
    if (parsed) out.getonboard = parsed;
  }
  if (obj.jobicy) {
    const parsed = parseResult(obj.jobicy);
    if (parsed) out.jobicy = parsed;
  }

  return out;
}

function migrateLegacy(rawKey: string): StoredJobCrawlSession | null {
  try {
    const raw = localStorage.getItem(rawKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;

    const obj = parsed as Record<string, unknown>;

    if (Array.isArray(obj.jobs)) {
      const jobs = parseJobs(obj.jobs);
      const listingUrls = parseListingUrls(obj.listingUrls);
      const selectedPlatforms = parsePlatforms(obj.selectedPlatforms);
      if (!listingUrls || selectedPlatforms.length === 0) return null;

      return {
        selectedPlatforms,
        listingUrls,
        jobs,
        savedAt: typeof obj.savedAt === "string" ? obj.savedAt : "",
        newJobKeys: Array.isArray(obj.newJobKeys)
          ? obj.newJobKeys.filter((key): key is string => typeof key === "string")
          : undefined,
        lastDiff:
          obj.lastDiff &&
          typeof obj.lastDiff === "object" &&
          typeof (obj.lastDiff as StoredJobCrawlDiff).added === "number" &&
          typeof (obj.lastDiff as StoredJobCrawlDiff).removed === "number"
            ? {
                added: (obj.lastDiff as StoredJobCrawlDiff).added,
                removed: (obj.lastDiff as StoredJobCrawlDiff).removed,
              }
            : undefined,
      };
    }

    if (obj.results) {
      const listingUrls = parseListingUrls(obj.listingUrls);
      const selectedPlatforms = parsePlatforms(obj.selectedPlatforms);
      const results = parseResults(obj.results);
      if (!listingUrls || selectedPlatforms.length === 0) return null;

      return {
        selectedPlatforms,
        listingUrls,
        jobs: flattenCrawlResults(results, selectedPlatforms),
        savedAt: typeof obj.savedAt === "string" ? obj.savedAt : "",
      };
    }

    if (obj.result && isPlatform(obj.platform)) {
      const result = parseResult(obj.result);
      if (!result) return null;
      const listingUrl = typeof obj.listingUrl === "string" ? obj.listingUrl : "";
      const platform = obj.platform;

      return {
        selectedPlatforms: [platform],
        listingUrls: mergeListingUrls({
          builtin: platform === "builtin" ? listingUrl : "",
          hiringcafe: platform === "hiringcafe" ? listingUrl : "",
          workable: platform === "workable" ? listingUrl : "",
          workingnomads: platform === "workingnomads" ? listingUrl : "",
          himalayas: platform === "himalayas" ? listingUrl : "",
          getonboard: platform === "getonboard" ? listingUrl : "",
          jobicy: platform === "jobicy" ? listingUrl : "",
        }),
        jobs: flattenCrawlResults({ [platform]: result }, [platform]),
        savedAt: typeof obj.savedAt === "string" ? obj.savedAt : "",
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function loadStoredJobCrawl(userId?: string | null): StoredJobCrawlSession | null {
  if (typeof window === "undefined") return null;

  const userKey = storageKeyForUser(userId);
  const userScoped = migrateLegacy(userKey);
  if (userScoped) return userScoped;

  // One-time migrate from global (pre-profile) key into the user-scoped slot.
  if (userId?.trim()) {
    const legacy = migrateLegacy(STORAGE_KEY);
    if (legacy) {
      try {
        localStorage.setItem(userKey, JSON.stringify(legacy));
      } catch {
        // ignore quota / private mode
      }
      return legacy;
    }
  }

  return (
    migrateLegacy(STORAGE_KEY) ??
    migrateLegacy("dv21:job-discovery-crawl:v2") ??
    migrateLegacy("dv21:job-discovery-crawl:v1")
  );
}

export function saveStoredJobCrawl(session: StoredJobCrawlSession, userId?: string | null): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(storageKeyForUser(userId), JSON.stringify(session));
    localStorage.removeItem("dv21:job-discovery-crawl:v2");
    localStorage.removeItem("dv21:job-discovery-crawl:v1");
  } catch {
    // ignore quota / private mode
  }
}

export function clearStoredJobCrawl(userId?: string | null): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(storageKeyForUser(userId));
    if (!userId?.trim()) {
      localStorage.removeItem(STORAGE_KEY);
    }
    localStorage.removeItem("dv21:job-discovery-crawl:v2");
    localStorage.removeItem("dv21:job-discovery-crawl:v1");
  } catch {
    // ignore
  }
}
