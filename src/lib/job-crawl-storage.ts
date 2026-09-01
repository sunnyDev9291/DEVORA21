import type { JobCrawlPlatform, JobCrawlResult } from "@/lib/builtin-crawl-types";

const STORAGE_KEY = "dv21:job-discovery-crawl:v2";

export type StoredJobCrawlSession = {
  selectedPlatforms: JobCrawlPlatform[];
  listingUrls: Record<JobCrawlPlatform, string>;
  results: Partial<Record<JobCrawlPlatform, JobCrawlResult>>;
  savedAt: string;
};

function isPlatform(value: unknown): value is JobCrawlPlatform {
  return value === "builtin" || value === "hiringcafe";
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

function parseListingUrls(raw: unknown): Record<JobCrawlPlatform, string> | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const builtin = typeof obj.builtin === "string" ? obj.builtin : "";
  const hiringcafe = typeof obj.hiringcafe === "string" ? obj.hiringcafe : "";
  return { builtin, hiringcafe };
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

  return out;
}

function parsePlatforms(raw: unknown): JobCrawlPlatform[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isPlatform);
}

function migrateV1(): StoredJobCrawlSession | null {
  try {
    const raw = localStorage.getItem("dv21:job-discovery-crawl:v1");
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;

    const obj = parsed as Record<string, unknown>;
    const result = parseResult(obj.result);
    if (!result || !isPlatform(obj.platform)) return null;

    const listingUrl = typeof obj.listingUrl === "string" ? obj.listingUrl : "";
    const platform = obj.platform;

    return {
      selectedPlatforms: [platform],
      listingUrls: {
        builtin: platform === "builtin" ? listingUrl : "",
        hiringcafe: platform === "hiringcafe" ? listingUrl : "",
      },
      results: { [platform]: result },
      savedAt: typeof obj.savedAt === "string" ? obj.savedAt : "",
    };
  } catch {
    return null;
  }
}

export function loadStoredJobCrawl(): StoredJobCrawlSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return migrateV1();

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return migrateV1();

    const obj = parsed as Record<string, unknown>;
    const listingUrls = parseListingUrls(obj.listingUrls);
    const selectedPlatforms = parsePlatforms(obj.selectedPlatforms);
    const results = parseResults(obj.results);

    if (!listingUrls || selectedPlatforms.length === 0) return migrateV1();

    return {
      selectedPlatforms,
      listingUrls,
      results,
      savedAt: typeof obj.savedAt === "string" ? obj.savedAt : "",
    };
  } catch {
    return migrateV1();
  }
}

export function saveStoredJobCrawl(session: StoredJobCrawlSession): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    localStorage.removeItem("dv21:job-discovery-crawl:v1");
  } catch {
    // ignore quota / private mode
  }
}

export function clearStoredJobCrawl(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("dv21:job-discovery-crawl:v1");
  } catch {
    // ignore
  }
}
