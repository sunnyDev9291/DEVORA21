export type JobCrawlJob = {
  jobId: string;
  companyName: string;
  jobTitle: string;
  jobUrl: string;
};

/** @deprecated Use JobCrawlJob */
export type BuiltInCrawlJob = JobCrawlJob;

export type JobCrawlPlatform = "builtin" | "hiringcafe" | "workable" | "workingnomads";

export const ALL_JOB_CRAWL_PLATFORMS: JobCrawlPlatform[] = [
  "builtin",
  "hiringcafe",
  "workable",
  "workingnomads",
];

export type JobCrawlResult = {
  sourceUrl: string;
  platform: JobCrawlPlatform;
  pagesScraped?: number;
  totalCount: number;
  jobs: JobCrawlJob[];
};

/** Single merged row in the job discovery table. */
export type DiscoveredJobRow = JobCrawlJob & {
  platform: JobCrawlPlatform;
};

/** @deprecated Use JobCrawlResult */
export type BuiltInCrawlResult = JobCrawlResult;

export type BuiltInCrawlRequest = {
  url: string;
};

/** Default Built In page-1 listing (backend handles pagination). */
export const DEFAULT_BUILTIN_LISTING_URL =
  "https://builtin.com/jobs/remote/mid-level/senior/expert-leader?daysSinceUpdated=1&country=ARG&allLocations=true";

/** Default HiringCafe page-0 listing (backend handles pagination). */
export const DEFAULT_HIRINGCAFE_LISTING_URL =
  "https://hiringcafe.com/?searchState=%7B%22locations%22%3A%5B%7B%22formatted_address%22%3A%22Argentina%22%2C%22types%22%3A%5B%22country%22%5D%2C%22geometry%22%3A%7B%22location%22%3A%7B%22lat%22%3A-34.6142%2C%22lon%22%3A-58.3811%7D%7D%2C%22id%22%3A%22user_country%22%2C%22address_components%22%3A%5B%7B%22long_name%22%3A%22Argentina%22%2C%22short_name%22%3A%22AR%22%2C%22types%22%3A%5B%22country%22%5D%7D%5D%2C%22options%22%3A%7B%22flexible_regions%22%3A%5B%22anywhere_in_continent%22%2C%22anywhere_in_world%22%5D%7D%2C%22workplace_types%22%3A%5B%22Remote%22%5D%7D%5D%2C%22searchQuery%22%3A%22engineer+developer%22%2C%22dateFetchedPastNDays%22%3A2%7D";

/** Default Workable search URL (single page — copy filters from browser). */
export const DEFAULT_WORKABLE_LISTING_URL =
  "https://jobs.workable.com/search?location=Argentina&day_range=1&query=specialist++%7C+engineer+%7C+developer+%7C+Scientist&workplace=remote";

/** Default Working Nomads listing URL (single page — copy filters from browser). */
export const DEFAULT_WORKINGNOMADS_LISTING_URL =
  "https://www.workingnomads.com/jobs?category=development&location=argentina&postedDate=1";

export const DEFAULT_LISTING_URLS: Record<JobCrawlPlatform, string> = {
  builtin: DEFAULT_BUILTIN_LISTING_URL,
  hiringcafe: DEFAULT_HIRINGCAFE_LISTING_URL,
  workable: DEFAULT_WORKABLE_LISTING_URL,
  workingnomads: DEFAULT_WORKINGNOMADS_LISTING_URL,
};

export const JOB_CRAWL_PLATFORM_LABEL: Record<JobCrawlPlatform, string> = {
  builtin: "Built In",
  hiringcafe: "HiringCafe",
  workable: "Workable",
  workingnomads: "Working Nomads",
};

export const JOB_CRAWL_PLATFORM_PLACEHOLDER: Record<JobCrawlPlatform, string> = {
  builtin: "https://builtin.com/jobs/…",
  hiringcafe: "https://hiringcafe.com/?searchState=…",
  workable: "https://jobs.workable.com/search?…",
  workingnomads: "https://www.workingnomads.com/jobs?…",
};

export const JOB_CRAWL_PLATFORM_HINT: Record<JobCrawlPlatform, string> = {
  builtin: "Page 1 listing — backend handles pagination.",
  hiringcafe: "Page 0 listing with searchState — backend handles pagination.",
  workable: "Copy the full /search URL from Workable after setting filters (single page, no pagination).",
  workingnomads:
    "Copy the full /jobs URL from Working Nomads after setting filters (single page, no pagination).",
};

export const JOB_CRAWL_PLATFORM_VALIDATOR: Record<JobCrawlPlatform, (url: string) => boolean> = {
  builtin: isBuiltInListingUrl,
  hiringcafe: isHiringCafeListingUrl,
  workable: isWorkableListingUrl,
  workingnomads: isWorkingNomadsListingUrl,
};

/** Fill missing platform URLs from defaults (e.g. after adding Workable to saved sessions). */
export function mergeListingUrls(
  stored: Partial<Record<JobCrawlPlatform, string>> | null | undefined
): Record<JobCrawlPlatform, string> {
  return {
    builtin: stored?.builtin?.trim() || DEFAULT_BUILTIN_LISTING_URL,
    hiringcafe: stored?.hiringcafe?.trim() || DEFAULT_HIRINGCAFE_LISTING_URL,
    workable: stored?.workable?.trim() || DEFAULT_WORKABLE_LISTING_URL,
    workingnomads: stored?.workingnomads?.trim() || DEFAULT_WORKINGNOMADS_LISTING_URL,
  };
}

/** Parse a partial listingUrls object from API / localStorage JSON. */
export function parseListingUrlsPartial(
  raw: unknown
): Partial<Record<JobCrawlPlatform, string>> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;
  const next: Partial<Record<JobCrawlPlatform, string>> = {};
  for (const platform of ALL_JOB_CRAWL_PLATFORMS) {
    const value = obj[platform];
    if (typeof value === "string" && value.trim()) {
      next[platform] = value.trim();
    }
  }
  return Object.keys(next).length ? next : undefined;
}

/** Keep only non-empty trimmed platform URLs (profile source of truth). */
export function compactListingUrls(
  urls: Partial<Record<JobCrawlPlatform, string>> | null | undefined
): Partial<Record<JobCrawlPlatform, string>> | undefined {
  if (!urls) return undefined;
  const next: Partial<Record<JobCrawlPlatform, string>> = {};
  for (const platform of ALL_JOB_CRAWL_PLATFORMS) {
    const value = urls[platform]?.trim();
    if (value) next[platform] = value;
  }
  return Object.keys(next).length ? next : undefined;
}

/** Client timeout — crawl can take 30–90s+ across multiple Zyte calls. */
export const BUILTIN_CRAWL_TIMEOUT_MS = 120_000;

export function isBuiltInListingUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.replace(/^www\./, "");
    if (host !== "builtin.com") return false;
    return parsed.pathname.startsWith("/jobs");
  } catch {
    return false;
  }
}

export function isHiringCafeListingUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.replace(/^www\./, "");
    if (host !== "hiringcafe.com") return false;
    if (parsed.pathname.startsWith("/job/")) return false;
    return parsed.pathname === "/" || parsed.pathname === "";
  } catch {
    return false;
  }
}

export function isWorkableListingUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.replace(/^www\./, "");
    if (host !== "jobs.workable.com") return false;
    return parsed.pathname === "/search" || parsed.pathname.startsWith("/search/");
  } catch {
    return false;
  }
}

export function isWorkingNomadsListingUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.replace(/^www\./, "");
    if (host !== "workingnomads.com") return false;
    return parsed.pathname === "/jobs";
  } catch {
    return false;
  }
}

export function detectJobCrawlPlatform(url: string): JobCrawlPlatform | null {
  if (isBuiltInListingUrl(url)) return "builtin";
  if (isHiringCafeListingUrl(url)) return "hiringcafe";
  if (isWorkableListingUrl(url)) return "workable";
  if (isWorkingNomadsListingUrl(url)) return "workingnomads";
  return null;
}

export function isSupportedJobListingUrl(url: string): boolean {
  return detectJobCrawlPlatform(url) !== null;
}

export function stripListingPageParam(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.searchParams.delete("page");
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

/** @deprecated Use stripListingPageParam */
export function stripBuiltInPageParam(url: string): string {
  return stripListingPageParam(url);
}
