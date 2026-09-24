import type { DiscoveredJobRow } from "@/lib/builtin-crawl-types";

/** Stable identity for comparing crawl results across runs. Prefer URL when present. */
export function jobIdentityKey(job: Pick<DiscoveredJobRow, "platform" | "jobId" | "jobUrl" | "jobTitle" | "companyName">): string {
  const url = job.jobUrl.trim().replace(/\/+$/, "").toLowerCase();
  if (url) return `url:${url}`;
  return `id:${job.platform}:${job.jobId}:${job.jobTitle.trim().toLowerCase()}:${job.companyName.trim().toLowerCase()}`;
}

export type CrawlJobDiff = {
  added: number;
  removed: number;
  newKeys: Set<string>;
};

/** Compare previous crawl jobs to the latest crawl. */
export function diffCrawlJobs(
  previous: DiscoveredJobRow[],
  next: DiscoveredJobRow[]
): CrawlJobDiff {
  const prevKeys = new Set(previous.map(jobIdentityKey));
  const nextKeys = new Set(next.map(jobIdentityKey));
  const newKeys = new Set<string>();
  let added = 0;
  let removed = 0;

  for (const key of nextKeys) {
    if (!prevKeys.has(key)) {
      added += 1;
      newKeys.add(key);
    }
  }
  for (const key of prevKeys) {
    if (!nextKeys.has(key)) removed += 1;
  }

  return { added, removed, newKeys };
}
