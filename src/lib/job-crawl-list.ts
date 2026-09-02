import type { DiscoveredJobRow, JobCrawlPlatform, JobCrawlResult } from "@/lib/builtin-crawl-types";

/** Flatten platform crawl results into one merged job list. */
export function flattenCrawlResults(
  results: Partial<Record<JobCrawlPlatform, JobCrawlResult>>,
  platforms: JobCrawlPlatform[]
): DiscoveredJobRow[] {
  const rows: DiscoveredJobRow[] = [];

  for (const platform of platforms) {
    const result = results[platform];
    if (!result?.jobs.length) continue;

    for (const job of result.jobs) {
      rows.push({ ...job, platform });
    }
  }

  return rows;
}
