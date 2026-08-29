export type BuiltInCrawlJob = {
  jobId: string;
  companyName: string;
  jobTitle: string;
  jobUrl: string;
};

export type BuiltInCrawlResult = {
  sourceUrl: string;
  platform: "builtin";
  pagesScraped: number;
  totalCount: number;
  jobs: BuiltInCrawlJob[];
};

export type BuiltInCrawlRequest = {
  url: string;
};

/** Default Built In page-1 listing (backend handles pagination). */
export const DEFAULT_BUILTIN_LISTING_URL =
  "https://builtin.com/jobs/remote/mid-level/senior/expert-leader?daysSinceUpdated=1&country=ARG&allLocations=true";

/** Client timeout — crawl can take 30–90s across multiple Zyte calls. */
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

export function stripBuiltInPageParam(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.searchParams.delete("page");
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.trim();
  }
}
