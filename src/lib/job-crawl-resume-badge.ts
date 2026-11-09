import type { DiscoveredJobRow } from "@/lib/builtin-crawl-types";
import type { SavedResumeArchive } from "@/lib/saved-resumes-types";
import { JOB_URL_NOT_TRACKED, isHttpJobUrl, normalizeStoredJobUrl } from "@/lib/resume-job-url";

/** Days since last resume archive before a match becomes "possible" instead of "bad". */
export const CRAWL_RESUME_POSSIBLE_AFTER_DAYS = 10;

export type CrawlJobResumeBadge = "good" | "possible" | "bad";

export type CrawlResumeMatchIndex = {
  /** Normalized http(s) jobUrl → latest bidAt ms */
  byUrl: Map<string, number>;
  /** company|title → latest bidAt ms */
  byCompanyTitle: Map<string, number>;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function normalizeCrawlJobUrl(raw: string | null | undefined): string {
  const value = normalizeStoredJobUrl(raw);
  if (!isHttpJobUrl(value) || value === JOB_URL_NOT_TRACKED) return "";
  return value.replace(/\/+$/, "").toLowerCase();
}

export function companyTitleKey(companyName: string, jobTitle: string): string {
  return `${companyName.trim().toLowerCase()}|${jobTitle.trim().toLowerCase()}`;
}

function rememberLatest(map: Map<string, number>, key: string, bidAtMs: number): void {
  if (!key) return;
  const prev = map.get(key);
  if (prev === undefined || bidAtMs > prev) map.set(key, bidAtMs);
}

/** Build one lookup index from lean saved-resume archives (O(archives)). */
export function buildCrawlResumeMatchIndex(
  archives: SavedResumeArchive[]
): CrawlResumeMatchIndex {
  const byUrl = new Map<string, number>();
  const byCompanyTitle = new Map<string, number>();

  for (const archive of archives) {
    const bidAtMs = Date.parse(archive.bidAt);
    if (!Number.isFinite(bidAtMs)) continue;

    const urlKey = normalizeCrawlJobUrl(archive.jobUrl);
    rememberLatest(byUrl, urlKey, bidAtMs);

    const ctKey = companyTitleKey(archive.companyName, archive.jobTitle);
    rememberLatest(byCompanyTitle, ctKey, bidAtMs);
  }

  return { byUrl, byCompanyTitle };
}

/** Latest matching resume bidAt for a crawled job, or null if none. */
export function findLatestResumeBidAtMs(
  job: Pick<DiscoveredJobRow, "jobUrl" | "companyName" | "jobTitle">,
  index: CrawlResumeMatchIndex
): number | null {
  const urlKey = normalizeCrawlJobUrl(job.jobUrl);
  if (urlKey) {
    const byUrl = index.byUrl.get(urlKey);
    if (byUrl !== undefined) return byUrl;
  }

  const ctKey = companyTitleKey(job.companyName, job.jobTitle);
  if (!ctKey || ctKey === "|") return null;
  const byCt = index.byCompanyTitle.get(ctKey);
  return byCt === undefined ? null : byCt;
}

export function resolveCrawlJobResumeBadge(
  job: Pick<DiscoveredJobRow, "jobUrl" | "companyName" | "jobTitle">,
  index: CrawlResumeMatchIndex,
  nowMs: number = Date.now()
): CrawlJobResumeBadge {
  const lastBidAtMs = findLatestResumeBidAtMs(job, index);
  if (lastBidAtMs === null) return "good";

  const ageDays = (nowMs - lastBidAtMs) / MS_PER_DAY;
  if (ageDays >= CRAWL_RESUME_POSSIBLE_AFTER_DAYS) return "possible";
  return "bad";
}

export function crawlResumeBadgeRank(badge: CrawlJobResumeBadge): number {
  if (badge === "good") return 0;
  if (badge === "possible") return 1;
  return 2;
}

export function crawlResumeBadgeLabel(badge: CrawlJobResumeBadge): string {
  if (badge === "good") return "good";
  if (badge === "possible") return "possible";
  return "bad";
}

/** Map each job identity → badge in one pass. */
export function buildCrawlJobBadgeMap(
  jobs: DiscoveredJobRow[],
  index: CrawlResumeMatchIndex,
  identityKey: (job: DiscoveredJobRow) => string,
  nowMs: number = Date.now()
): Map<string, CrawlJobResumeBadge> {
  const out = new Map<string, CrawlJobResumeBadge>();
  for (const job of jobs) {
    out.set(identityKey(job), resolveCrawlJobResumeBadge(job, index, nowMs));
  }
  return out;
}

export function countCrawlJobBadges(
  jobs: DiscoveredJobRow[],
  badgeByKey: Map<string, CrawlJobResumeBadge>,
  identityKey: (job: DiscoveredJobRow) => string
): { good: number; possible: number; bad: number } {
  let good = 0;
  let possible = 0;
  let bad = 0;
  for (const job of jobs) {
    const badge = badgeByKey.get(identityKey(job)) ?? "good";
    if (badge === "good") good += 1;
    else if (badge === "possible") possible += 1;
    else bad += 1;
  }
  return { good, possible, bad };
}
