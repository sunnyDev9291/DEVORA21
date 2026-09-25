export type JobCrawlJob = {
  jobId: string;
  companyName: string;
  jobTitle: string;
  jobUrl: string;
};

/** @deprecated Use JobCrawlJob */
export type BuiltInCrawlJob = JobCrawlJob;

export type JobCrawlPlatform =
  | "builtin"
  | "hiringcafe"
  | "workable"
  | "workingnomads"
  | "himalayas"
  | "getonboard"
  | "jobicy";

export const ALL_JOB_CRAWL_PLATFORMS: JobCrawlPlatform[] = [
  "builtin",
  "hiringcafe",
  "workable",
  "workingnomads",
  "himalayas",
  "getonboard",
  "jobicy",
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

/** Default Himalayas country filter (free public API — no listing URL). */
export const DEFAULT_HIMALAYAS_COUNTRY = "Argentina";

/** @deprecated Use DEFAULT_HIMALAYAS_COUNTRY — stored value is a country name, not a URL. */
export const DEFAULT_HIMALAYAS_LISTING_URL = DEFAULT_HIMALAYAS_COUNTRY;

/** Default Get on Board country filter (public search API — no listing URL). */
export const DEFAULT_GETONBOARD_COUNTRY = "Argentina";

/** Default Jobicy country filter (free Remote Jobs API — no listing URL). */
export const DEFAULT_JOBICY_COUNTRY = "Argentina";

export const DEFAULT_LISTING_URLS: Record<JobCrawlPlatform, string> = {
  builtin: DEFAULT_BUILTIN_LISTING_URL,
  hiringcafe: DEFAULT_HIRINGCAFE_LISTING_URL,
  workable: DEFAULT_WORKABLE_LISTING_URL,
  workingnomads: DEFAULT_WORKINGNOMADS_LISTING_URL,
  himalayas: DEFAULT_HIMALAYAS_COUNTRY,
  getonboard: DEFAULT_GETONBOARD_COUNTRY,
  jobicy: DEFAULT_JOBICY_COUNTRY,
};

export const JOB_CRAWL_PLATFORM_LABEL: Record<JobCrawlPlatform, string> = {
  builtin: "Built In",
  hiringcafe: "HiringCafe",
  workable: "Workable",
  workingnomads: "Working Nomads",
  himalayas: "Himalayas",
  getonboard: "Get on Board",
  jobicy: "Jobicy",
};

export const JOB_CRAWL_PLATFORM_PLACEHOLDER: Record<JobCrawlPlatform, string> = {
  builtin: "https://builtin.com/jobs/…",
  hiringcafe: "https://hiringcafe.com/?searchState=…",
  workable: "https://jobs.workable.com/search?…",
  workingnomads: "https://www.workingnomads.com/jobs?…",
  himalayas: "Argentina",
  getonboard: "Argentina",
  jobicy: "Argentina",
};

export const JOB_CRAWL_PLATFORM_HINT: Record<JobCrawlPlatform, string> = {
  builtin: "Page 1 listing — backend handles pagination.",
  hiringcafe: "Page 0 listing with searchState — backend handles pagination.",
  workable: "Copy the full /search URL from Workable after setting filters (single page, no pagination).",
  workingnomads:
    "Copy the full /jobs URL from Working Nomads after setting filters (single page, no pagination).",
  himalayas: "Country name only (e.g. Argentina). Uses Himalayas free API — no listing URL needed.",
  getonboard:
    "Country name or ISO code (e.g. Argentina or AR). Uses Get on Board via backend — remote jobs from the last 24 hours.",
  jobicy:
    "Country name only (e.g. Argentina). Uses Jobicy via backend — remote jobs from the last 24 hours.",
};

/** Platforms that store a listing URL vs a simple filter value. */
export function isJobCrawlUrlPlatform(platform: JobCrawlPlatform): boolean {
  return platform !== "himalayas" && platform !== "getonboard" && platform !== "jobicy";
}

export const JOB_CRAWL_PLATFORM_VALIDATOR: Record<JobCrawlPlatform, (value: string) => boolean> = {
  builtin: isBuiltInListingUrl,
  hiringcafe: isHiringCafeListingUrl,
  workable: isWorkableListingUrl,
  workingnomads: isWorkingNomadsListingUrl,
  himalayas: isHimalayasCountry,
  getonboard: isGetOnBoardCountry,
  jobicy: isJobicyCountry,
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
    himalayas: normalizeHimalayasCountry(stored?.himalayas ?? "") || DEFAULT_HIMALAYAS_COUNTRY,
    getonboard: normalizeGetOnBoardCountry(stored?.getonboard ?? "") || DEFAULT_GETONBOARD_COUNTRY,
    jobicy: normalizeJobicyCountry(stored?.jobicy ?? "") || DEFAULT_JOBICY_COUNTRY,
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

/** Listing only — not /jobs/{slug} detail pages or /jobs/api. */
export function isHimalayasListingUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.replace(/^www\./, "");
    if (host !== "himalayas.app") return false;
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    return path === "/jobs";
  } catch {
    return false;
  }
}

/**
 * Normalize Himalayas profile value to a country name.
 * Accepts plain "Argentina" or a legacy himalayas.app/jobs?countries=… URL.
 */
export function normalizeHimalayasCountry(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.replace(/^www\./, "") === "himalayas.app") {
      const fromQuery =
        parsed.searchParams.get("countries")?.trim() ||
        parsed.searchParams.get("country")?.trim() ||
        "";
      return fromQuery || DEFAULT_HIMALAYAS_COUNTRY;
    }
  } catch {
    // Not a URL — treat as country name / ISO code.
  }
  return trimmed;
}

/** Country name or ISO code for Himalayas free API (not a listing URL). */
export function isHimalayasCountry(value: string): boolean {
  const country = normalizeHimalayasCountry(value);
  if (country.length < 2 || country.length > 56) return false;
  return /^[A-Za-z][A-Za-z\s.'-]*$/.test(country);
}

/** Normalize Get on Board profile value to a country name (same rules as Himalayas). */
export function normalizeGetOnBoardCountry(value: string): string {
  return normalizeHimalayasCountry(value);
}

/** Country name for Get on Board public search (`country_code` resolved on backend). */
export function isGetOnBoardCountry(value: string): boolean {
  return isHimalayasCountry(value);
}

/** Normalize Jobicy profile value to a country name (same rules as Himalayas). */
export function normalizeJobicyCountry(value: string): string {
  return normalizeHimalayasCountry(value);
}

/** Country name for Jobicy free Remote Jobs API (geo resolved on backend). */
export function isJobicyCountry(value: string): boolean {
  return isHimalayasCountry(value);
}

/**
 * Map a user-entered country name to ISO 3166-1 alpha-2 for Get on Board `country_code`.
 * Backend should use this (or extend it) when calling the public search API.
 */
export function getOnBoardCountryToIso(country: string): string | null {
  const key = normalizeGetOnBoardCountry(country).toLowerCase();
  if (/^[a-z]{2}$/.test(key)) return key.toUpperCase();
  const map: Record<string, string> = {
    argentina: "AR",
    brazil: "BR",
    brasil: "BR",
    chile: "CL",
    colombia: "CO",
    "dominican republic": "DO",
    mexico: "MX",
    peru: "PE",
    uruguay: "UY",
    paraguay: "PY",
    bolivia: "BO",
    ecuador: "EC",
    venezuela: "VE",
    "costa rica": "CR",
    panama: "PA",
    guatemala: "GT",
    honduras: "HN",
    "el salvador": "SV",
    nicaragua: "NI",
    cuba: "CU",
    "puerto rico": "PR",
    spain: "ES",
    "united states": "US",
    usa: "US",
  };
  return map[key] ?? null;
}

export function detectJobCrawlPlatform(url: string): JobCrawlPlatform | null {
  if (isBuiltInListingUrl(url)) return "builtin";
  if (isHiringCafeListingUrl(url)) return "hiringcafe";
  if (isWorkableListingUrl(url)) return "workable";
  if (isWorkingNomadsListingUrl(url)) return "workingnomads";
  // Himalayas / Get on Board / Jobicy use country-only filters — not listing URLs.
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
