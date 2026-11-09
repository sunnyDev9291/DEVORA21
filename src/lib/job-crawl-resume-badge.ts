import type { DiscoveredJobRow } from "@/lib/builtin-crawl-types";
import type { SavedResumeArchive } from "@/lib/saved-resumes-types";

/** Days since last resume archive before a company match becomes "possible" instead of "bad". */
export const CRAWL_RESUME_POSSIBLE_AFTER_DAYS = 10;

export type CrawlJobResumeBadge = "good" | "possible" | "bad";

export type CrawlResumeMatchIndex = {
  /** Normalized company name → latest bidAt ms */
  byCompany: Map<string, number>;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Legal / entity-type suffixes stripped from the end of a company name for matching.
 * Longest-first so "limited liability company" wins over "company" / "limited".
 */
const COMPANY_TYPE_SUFFIXES: readonly string[] = [
  "limited liability company",
  "limited liability co",
  "professional corporation",
  "public limited company",
  "limited partnership",
  "limited company",
  "incorporated",
  "corporation",
  "company",
  "limited",
  "pllc",
  "llc",
  "llp",
  "ltd",
  "inc",
  "corp",
  "plc",
  "pty",
  "pte",
  "pvt",
  "gmbh",
  "lp",
  "pc",
  "co",
  "ag",
  "bv",
  "nv",
  "sas",
  "srl",
  "sa",
].slice().sort((a, b) => b.length - a.length);

/**
 * Matching key for company badges.
 * trim → lowercase → & → "and" → drop legal punctuation → strip trailing entity suffixes
 * (Inc / LLC / Ltd / Corp / …) repeatedly → collapse whitespace.
 * Display names stay untouched; this is lookup-only.
 */
export function companyBadgeKey(companyName: string | undefined | null): string {
  let value = (companyName ?? "").trim().toLowerCase();
  if (!value) return "";

  value = value.replace(/&/g, " and ");
  // Collapse dotted initialisms before stripping punctuation: "L.L.C." → "llc"
  value = value.replace(/\b(?:[a-z]\.)+[a-z]\.?\b/g, (match) => match.replace(/\./g, ""));
  // "Inc." / "Co., Ltd." → tokens without punctuation noise
  value = value.replace(/[.,/#'"`()]/g, " ");
  value = value.replace(/\s+/g, " ").trim();

  let previous = "";
  while (previous !== value) {
    previous = value;
    for (const suffix of COMPANY_TYPE_SUFFIXES) {
      if (value === suffix) {
        value = "";
        break;
      }
      const trailed = ` ${suffix}`;
      if (value.endsWith(trailed)) {
        value = value.slice(0, -trailed.length).trim();
        break;
      }
    }
  }

  return value.replace(/\s+/g, " ").trim();
}

function rememberLatest(map: Map<string, number>, key: string, bidAtMs: number): void {
  if (!key) return;
  const prev = map.get(key);
  if (prev === undefined || bidAtMs > prev) map.set(key, bidAtMs);
}

/** Build one company→latest-bidAt index from lean saved-resume archives (O(archives)). */
export function buildCrawlResumeMatchIndex(
  archives: SavedResumeArchive[]
): CrawlResumeMatchIndex {
  const byCompany = new Map<string, number>();

  for (const archive of archives) {
    const bidAtMs = Date.parse(archive.bidAt);
    if (!Number.isFinite(bidAtMs)) continue;
    rememberLatest(byCompany, companyBadgeKey(archive.companyName), bidAtMs);
  }

  return { byCompany };
}

/** Latest matching resume bidAt for a company, or null if none. */
export function findLatestResumeBidAtMs(
  companyName: string | undefined | null,
  index: CrawlResumeMatchIndex
): number | null {
  const key = companyBadgeKey(companyName);
  if (!key) return null;
  const bidAtMs = index.byCompany.get(key);
  return bidAtMs === undefined ? null : bidAtMs;
}

export function resolveCompanyResumeBadge(
  companyName: string | undefined | null,
  index: CrawlResumeMatchIndex,
  nowMs: number = Date.now()
): CrawlJobResumeBadge {
  const lastBidAtMs = findLatestResumeBidAtMs(companyName, index);
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

/** Map each company key → badge in one pass over jobs. */
export function buildCrawlCompanyBadgeMap(
  jobs: Array<Pick<DiscoveredJobRow, "companyName">>,
  index: CrawlResumeMatchIndex,
  nowMs: number = Date.now()
): Map<string, CrawlJobResumeBadge> {
  const out = new Map<string, CrawlJobResumeBadge>();
  for (const job of jobs) {
    const key = companyBadgeKey(job.companyName);
    if (out.has(key)) continue;
    out.set(key, resolveCompanyResumeBadge(job.companyName, index, nowMs));
  }
  return out;
}

/** Count unique companies in the job list by badge. */
export function countCrawlCompanyBadges(
  jobs: Array<Pick<DiscoveredJobRow, "companyName">>,
  badgeByCompany: Map<string, CrawlJobResumeBadge>
): { good: number; possible: number; bad: number } {
  let good = 0;
  let possible = 0;
  let bad = 0;
  const seen = new Set<string>();

  for (const job of jobs) {
    const key = companyBadgeKey(job.companyName);
    if (seen.has(key)) continue;
    seen.add(key);
    const badge = badgeByCompany.get(key) ?? "good";
    if (badge === "good") good += 1;
    else if (badge === "possible") possible += 1;
    else bad += 1;
  }

  return { good, possible, bad };
}
