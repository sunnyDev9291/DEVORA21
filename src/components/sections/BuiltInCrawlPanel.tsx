"use client";

import { useEffect, useState } from "react";
import { getApiErrorMessage } from "@/lib/auth-api";
import { crawlBuiltInJobs, crawlHiringCafeJobs } from "@/lib/builtin-crawl-api";
import {
  ALL_JOB_CRAWL_PLATFORMS,
  BUILTIN_CRAWL_TIMEOUT_MS,
  DEFAULT_BUILTIN_LISTING_URL,
  DEFAULT_HIRINGCAFE_LISTING_URL,
  isBuiltInListingUrl,
  isHiringCafeListingUrl,
  type JobCrawlJob,
  type JobCrawlPlatform,
  type JobCrawlResult,
} from "@/lib/builtin-crawl-types";
import { loadStoredJobCrawl, saveStoredJobCrawl } from "@/lib/job-crawl-storage";
import { formatEstDateTime } from "@/lib/format-est-datetime";

const inputClass =
  "w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.10] hover:border-slate-300 dark:hover:border-white/[0.16] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm outline-none transition-all";

const PLATFORM_LABEL: Record<JobCrawlPlatform, string> = {
  builtin: "Built In",
  hiringcafe: "HiringCafe",
};

const PLATFORM_DEFAULT_URL: Record<JobCrawlPlatform, string> = {
  builtin: DEFAULT_BUILTIN_LISTING_URL,
  hiringcafe: DEFAULT_HIRINGCAFE_LISTING_URL,
};

const PLATFORM_URL_VALID: Record<JobCrawlPlatform, (url: string) => boolean> = {
  builtin: isBuiltInListingUrl,
  hiringcafe: isHiringCafeListingUrl,
};

const PLATFORM_PLACEHOLDER: Record<JobCrawlPlatform, string> = {
  builtin: "https://builtin.com/jobs/…",
  hiringcafe: "https://hiringcafe.com/?searchState=…",
};

const PLATFORM_HINT: Record<JobCrawlPlatform, string> = {
  builtin: "Page 1 listing — backend handles pagination.",
  hiringcafe: "Page 0 listing with searchState — backend handles pagination.",
};

function defaultListingUrls(): Record<JobCrawlPlatform, string> {
  return { ...PLATFORM_DEFAULT_URL };
}

function defaultSelectedPlatforms(): JobCrawlPlatform[] {
  return [...ALL_JOB_CRAWL_PLATFORMS];
}

function platformButtonClass(platform: JobCrawlPlatform, selected: boolean): string {
  const base = "rounded-full px-4 py-1.5 text-sm font-semibold transition-all border";
  if (!selected) {
    return `${base} border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10`;
  }
  if (platform === "hiringcafe") {
    return `${base} border-emerald-500/30 bg-emerald-600 text-white shadow-md shadow-emerald-600/25`;
  }
  return `${base} border-violet-500/30 bg-violet-600 text-white shadow-md shadow-violet-600/25`;
}

function crawlPlatform(
  platform: JobCrawlPlatform,
  url: string,
  signal: AbortSignal
): Promise<JobCrawlResult> {
  return platform === "builtin" ? crawlBuiltInJobs(url, signal) : crawlHiringCafeJobs(url, signal);
}

function JobResultTable({ jobs }: { jobs: JobCrawlJob[] }) {
  if (jobs.length === 0) {
    return (
      <p className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
        Crawl finished but no jobs were returned.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/[0.08]">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3 font-semibold">Company</th>
            <th className="px-4 py-3 font-semibold">Job title</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
          {jobs.map((job, index) => (
            <tr key={`${job.jobId}-${index}`} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02]">
              <td className="px-4 py-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                {job.companyName || "—"}
              </td>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                {job.jobUrl ? (
                  <a
                    href={job.jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline underline-offset-2"
                  >
                    {job.jobTitle}
                  </a>
                ) : (
                  job.jobTitle
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BuiltInCrawlPanel() {
  const [selectedPlatforms, setSelectedPlatforms] = useState<JobCrawlPlatform[]>(defaultSelectedPlatforms);
  const [listingUrls, setListingUrls] = useState<Record<JobCrawlPlatform, string>>(defaultListingUrls);
  const [results, setResults] = useState<Partial<Record<JobCrawlPlatform, JobCrawlResult>>>({});
  const [platformErrors, setPlatformErrors] = useState<Partial<Record<JobCrawlPlatform, string>>>({});
  const [crawling, setCrawling] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [lastCrawledAt, setLastCrawledAt] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadStoredJobCrawl();
    if (stored) {
      setSelectedPlatforms(stored.selectedPlatforms);
      setListingUrls(stored.listingUrls);
      setResults(stored.results);
      if (stored.savedAt) setLastCrawledAt(stored.savedAt);
    }
    setHydrated(true);
  }, []);

  const allSelected = ALL_JOB_CRAWL_PLATFORMS.every((p) => selectedPlatforms.includes(p));
  const canCrawl =
    !crawling &&
    selectedPlatforms.length > 0 &&
    selectedPlatforms.every((p) => PLATFORM_URL_VALID[p](listingUrls[p]));

  function selectAllPlatforms() {
    setSelectedPlatforms([...ALL_JOB_CRAWL_PLATFORMS]);
    setPlatformErrors({});
  }

  function togglePlatform(platform: JobCrawlPlatform) {
    setPlatformErrors({});
    setSelectedPlatforms((current) => {
      if (current.includes(platform)) {
        if (current.length === 1) return current;
        return current.filter((p) => p !== platform);
      }
      return [...current, platform];
    });
  }

  function updateListingUrl(platform: JobCrawlPlatform, url: string) {
    setListingUrls((current) => ({ ...current, [platform]: url }));
  }

  async function handleCrawl() {
    if (!canCrawl) return;

    setCrawling(true);
    setPlatformErrors({});

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), BUILTIN_CRAWL_TIMEOUT_MS);

    const nextResults: Partial<Record<JobCrawlPlatform, JobCrawlResult>> = { ...results };
    const nextErrors: Partial<Record<JobCrawlPlatform, string>> = {};

    await Promise.all(
      selectedPlatforms.map(async (platform) => {
        try {
          const data = await crawlPlatform(platform, listingUrls[platform], controller.signal);
          nextResults[platform] = data;
        } catch (err) {
          nextErrors[platform] = getApiErrorMessage(err, `${PLATFORM_LABEL[platform]} crawl failed.`);
        }
      })
    );

    setResults(nextResults);
    setPlatformErrors(nextErrors);

    const hadSuccess = selectedPlatforms.some((platform) => !nextErrors[platform] && nextResults[platform]);

    if (hadSuccess) {
      const savedAt = new Date().toISOString();
      setLastCrawledAt(savedAt);
      saveStoredJobCrawl({
        selectedPlatforms,
        listingUrls,
        results: nextResults,
        savedAt,
      });
    }

    window.clearTimeout(timer);
    setCrawling(false);
  }

  const visibleResultPlatforms = ALL_JOB_CRAWL_PLATFORMS.filter((p) => results[p]);
  const hasResults = visibleResultPlatforms.length > 0;
  const lastCrawledLabel = lastCrawledAt ? formatEstDateTime(lastCrawledAt) : null;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-xl shadow-slate-200/50 backdrop-blur-sm dark:border-white/[0.08] dark:bg-navy-900/80 dark:shadow-black/30 sm:p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Job discovery</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Select one or more platforms, paste each listing URL, then crawl. Results are saved locally until the next
          crawl.
        </p>
        {hydrated && lastCrawledLabel ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Last crawled:{" "}
            <time dateTime={lastCrawledAt ?? undefined} className="font-medium tabular-nums">
              {lastCrawledLabel}
            </time>
          </p>
        ) : null}
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Platforms</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={selectAllPlatforms}
              disabled={crawling}
              className={[
                "rounded-full px-4 py-1.5 text-sm font-semibold transition-all border",
                allSelected
                  ? "border-blue-500/40 bg-blue-600 text-white shadow-md shadow-blue-600/25"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10",
              ].join(" ")}
            >
              All
            </button>
            {ALL_JOB_CRAWL_PLATFORMS.map((platform) => (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                disabled={crawling}
                className={platformButtonClass(platform, selectedPlatforms.includes(platform))}
              >
                {PLATFORM_LABEL[platform]}
              </button>
            ))}
          </div>
        </div>

        {selectedPlatforms.length === 0 ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">Select at least one platform to crawl.</p>
        ) : (
          <div className="space-y-4">
            {selectedPlatforms.map((platform) => (
              <div key={platform}>
                <label
                  htmlFor={`listingUrl-${platform}`}
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  {PLATFORM_LABEL[platform]} listing URL
                </label>
                <input
                  id={`listingUrl-${platform}`}
                  type="url"
                  value={listingUrls[platform]}
                  onChange={(e) => updateListingUrl(platform, e.target.value)}
                  placeholder={PLATFORM_PLACEHOLDER[platform]}
                  className={inputClass}
                  disabled={crawling}
                  spellCheck={false}
                />
                <p className="mt-1.5 text-xs text-slate-400">{PLATFORM_HINT[platform]}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-start sm:items-center">
          <button
            type="button"
            onClick={() => void handleCrawl()}
            disabled={!canCrawl}
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/25"
          >
            {crawling ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Crawling {selectedPlatforms.map((p) => PLATFORM_LABEL[p]).join(" + ")}…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Crawl jobs
              </>
            )}
          </button>
          {crawling ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              This can take <strong className="font-semibold">30–90+ seconds</strong> per platform…
            </p>
          ) : null}
        </div>
      </div>

      {hydrated && hasResults ? (
        <div className="mt-8 space-y-8">
          {visibleResultPlatforms.map((platform) => {
            const result = results[platform]!;

            return (
              <div key={platform} className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span
                    className={[
                      "inline-flex items-center rounded-full px-3 py-1 font-semibold",
                      platform === "hiringcafe"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-violet-500/15 text-violet-700 dark:text-violet-300",
                    ].join(" ")}
                  >
                    {PLATFORM_LABEL[platform]}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-500/10 px-3 py-1 font-semibold text-slate-700 dark:text-slate-300">
                    {result.totalCount} job{result.totalCount === 1 ? "" : "s"}
                  </span>
                  {typeof result.pagesScraped === "number" && result.pagesScraped > 0 ? (
                    <span className="text-slate-500 dark:text-slate-400">
                      {result.pagesScraped} page{result.pagesScraped === 1 ? "" : "s"} scraped
                    </span>
                  ) : null}
                  <span className="text-slate-400 dark:text-slate-500 truncate max-w-full" title={result.sourceUrl}>
                    {result.sourceUrl}
                  </span>
                </div>
                <JobResultTable jobs={result.jobs} />
              </div>
            );
          })}
        </div>
      ) : null}

      {hydrated && Object.keys(platformErrors).length > 0 ? (
        <div className="mt-6 space-y-3">
          {(Object.entries(platformErrors) as [JobCrawlPlatform, string][]).map(([platform, message]) => (
            <div
              key={platform}
              className="flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3"
            >
              <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-600 dark:text-red-300 whitespace-pre-wrap">
                <strong>{PLATFORM_LABEL[platform]}:</strong> {message}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
