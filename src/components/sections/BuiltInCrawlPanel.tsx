"use client";

import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "@/lib/auth-api";
import { crawlBuiltInJobs, crawlHiringCafeJobs, crawlWorkableJobs } from "@/lib/builtin-crawl-api";
import {
  ALL_JOB_CRAWL_PLATFORMS,
  BUILTIN_CRAWL_TIMEOUT_MS,
  DEFAULT_LISTING_URLS,
  mergeListingUrls,
  isBuiltInListingUrl,
  isHiringCafeListingUrl,
  isWorkableListingUrl,
  type DiscoveredJobRow,
  type JobCrawlPlatform,
  type JobCrawlResult,
} from "@/lib/builtin-crawl-types";
import { formatEstDateTimeParts } from "@/lib/format-est-datetime";
import { flattenCrawlResults } from "@/lib/job-crawl-list";
import { loadStoredJobCrawl, saveStoredJobCrawl } from "@/lib/job-crawl-storage";

const inputClass =
  "w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.10] hover:border-slate-300 dark:hover:border-white/[0.16] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm outline-none transition-all";

const PLATFORM_LABEL: Record<JobCrawlPlatform, string> = {
  builtin: "Built In",
  hiringcafe: "HiringCafe",
  workable: "Workable",
};

const PLATFORM_DEFAULT_URL = DEFAULT_LISTING_URLS;

const PLATFORM_URL_VALID: Record<JobCrawlPlatform, (url: string) => boolean> = {
  builtin: isBuiltInListingUrl,
  hiringcafe: isHiringCafeListingUrl,
  workable: isWorkableListingUrl,
};

const PLATFORM_PLACEHOLDER: Record<JobCrawlPlatform, string> = {
  builtin: "https://builtin.com/jobs/…",
  hiringcafe: "https://hiringcafe.com/?searchState=…",
  workable: "https://jobs.workable.com/search?…",
};

const PLATFORM_HINT: Record<JobCrawlPlatform, string> = {
  builtin: "Page 1 listing — backend handles pagination.",
  hiringcafe: "Page 0 listing with searchState — backend handles pagination.",
  workable: "Copy the full /search URL from Workable after setting filters (single page, no pagination).",
};

const PLATFORM_SELECTED_CLASS =
  "border-emerald-500/30 bg-emerald-600 text-white shadow-md shadow-emerald-600/25";
const PLATFORM_BADGE_CLASS =
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20";

function defaultListingUrls(): Record<JobCrawlPlatform, string> {
  return mergeListingUrls(null);
}

function defaultSelectedPlatforms(): JobCrawlPlatform[] {
  return [...ALL_JOB_CRAWL_PLATFORMS];
}

function jobRowKey(job: DiscoveredJobRow, index: number): string {
  return `${job.platform}-${job.jobId}-${index}`;
}

function platformButtonClass(selected: boolean): string {
  const base = "rounded-full px-4 py-1.5 text-sm font-semibold transition-all border";
  if (!selected) {
    return `${base} border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10`;
  }
  return `${base} ${PLATFORM_SELECTED_CLASS}`;
}

function crawlPlatform(
  platform: JobCrawlPlatform,
  url: string,
  signal: AbortSignal
): Promise<JobCrawlResult> {
  if (platform === "builtin") return crawlBuiltInJobs(url, signal);
  if (platform === "hiringcafe") return crawlHiringCafeJobs(url, signal);
  return crawlWorkableJobs(url, signal);
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyTextToClipboard(url);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/15"
      title="Copy job URL"
    >
      {copied ? "Copied" : "Copy URL"}
    </button>
  );
}

function LastCrawledBanner({ iso }: { iso: string }) {
  const parts = formatEstDateTimeParts(iso);
  if (!parts) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/[0.08] via-teal-500/[0.06] to-green-500/[0.08] shadow-sm dark:border-emerald-400/15">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700/80 dark:text-emerald-300/80">
              Last crawled
            </p>
            <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{parts.date}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:justify-end">
          <time
            dateTime={iso}
            className="inline-flex items-center rounded-full bg-white/70 px-3 py-1.5 text-sm font-semibold tabular-nums text-slate-800 shadow-sm ring-1 ring-slate-200/80 dark:bg-white/10 dark:text-white dark:ring-white/10"
          >
            {parts.time}
          </time>
          <span className="inline-flex items-center rounded-full bg-emerald-600/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
            {parts.zone}
          </span>
        </div>
      </div>
    </div>
  );
}

function MergedJobTable({
  jobs,
  checkedKeys,
  onToggleRow,
  onToggleAll,
  allChecked,
}: {
  jobs: DiscoveredJobRow[];
  checkedKeys: Set<string>;
  onToggleRow: (key: string) => void;
  onToggleAll: () => void;
  allChecked: boolean;
}) {
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
            <th className="px-4 py-3 font-semibold whitespace-nowrap">Platform</th>
            <th className="px-4 py-3 font-semibold whitespace-nowrap">Company</th>
            <th className="px-4 py-3 font-semibold min-w-[12rem]">Job title</th>
            <th className="px-4 py-3 font-semibold min-w-[10rem]">URL</th>
            <th className="px-4 py-3 font-semibold text-center w-12">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={onToggleAll}
                aria-label="Select all jobs"
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/30 dark:border-white/20 dark:bg-white/5"
              />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
          {jobs.map((job, index) => {
            const key = jobRowKey(job, index);
            const checked = checkedKeys.has(key);

            return (
              <tr
                key={key}
                className={
                  checked
                    ? "bg-emerald-500/[0.06] hover:bg-emerald-500/[0.08]"
                    : "hover:bg-slate-50/80 dark:hover:bg-white/[0.02]"
                }
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${PLATFORM_BADGE_CLASS}`}
                  >
                    {PLATFORM_LABEL[job.platform]}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                  {job.companyName || "—"}
                </td>
                <td className="px-4 py-3 text-slate-800 dark:text-slate-100">{job.jobTitle || "—"}</td>
                <td className="px-4 py-3 max-w-[20rem]">
                  {job.jobUrl ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <span title={job.jobUrl} className="truncate text-blue-600 dark:text-blue-400 select-all">
                        {job.jobUrl}
                      </span>
                      <CopyUrlButton url={job.jobUrl} />
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleRow(key)}
                    aria-label={`Select ${job.jobTitle || "job"}`}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/30 dark:border-white/20 dark:bg-white/5"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function BuiltInCrawlPanel() {
  const [selectedPlatforms, setSelectedPlatforms] = useState<JobCrawlPlatform[]>(defaultSelectedPlatforms);
  const [listingUrls, setListingUrls] = useState<Record<JobCrawlPlatform, string>>(defaultListingUrls);
  const [jobList, setJobList] = useState<DiscoveredJobRow[]>([]);
  const [checkedJobKeys, setCheckedJobKeys] = useState<Set<string>>(() => new Set());
  const [platformErrors, setPlatformErrors] = useState<Partial<Record<JobCrawlPlatform, string>>>({});
  const [crawling, setCrawling] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [lastCrawledAt, setLastCrawledAt] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadStoredJobCrawl();
    if (stored) {
      setSelectedPlatforms(stored.selectedPlatforms);
      setListingUrls(mergeListingUrls(stored.listingUrls));
      setJobList(stored.jobs);
      if (stored.savedAt) setLastCrawledAt(stored.savedAt);
    }
    setHydrated(true);
  }, []);

  const allPlatformSelected = ALL_JOB_CRAWL_PLATFORMS.every((p) => selectedPlatforms.includes(p));
  const canCrawl =
    !crawling &&
    selectedPlatforms.length > 1 &&
    selectedPlatforms.every((p) => {
      const url = listingUrls[p]?.trim() ?? "";
      return url.length > 0 && PLATFORM_URL_VALID[p](url);
    });

  const allJobsChecked = useMemo(() => {
    if (jobList.length === 0) return false;
    return jobList.every((job, index) => checkedJobKeys.has(jobRowKey(job, index)));
  }, [jobList, checkedJobKeys]);

  function selectAllPlatforms() {
    setSelectedPlatforms([...ALL_JOB_CRAWL_PLATFORMS]);
    setPlatformErrors({});
  }

  function togglePlatform(platform: JobCrawlPlatform) {
    setPlatformErrors({});
    setSelectedPlatforms((current) => {
      if (current.includes(platform)) {
        return current.filter((p) => p !== platform);
      }
      if (!listingUrls[platform]?.trim()) {
        setListingUrls((urls) => ({
          ...urls,
          [platform]: PLATFORM_DEFAULT_URL[platform],
        }));
      }
      return [...current, platform];
    });
  }

  function updateListingUrl(platform: JobCrawlPlatform, url: string) {
    setListingUrls((current) => ({ ...current, [platform]: url }));
  }

  function toggleJobRow(key: string) {
    setCheckedJobKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAllJobs() {
    if (allJobsChecked) {
      setCheckedJobKeys(new Set());
      return;
    }
    setCheckedJobKeys(new Set(jobList.map((job, index) => jobRowKey(job, index))));
  }

  async function handleCrawl() {
    if (!canCrawl) return;

    setCrawling(true);
    setPlatformErrors({});

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), BUILTIN_CRAWL_TIMEOUT_MS);

    const crawlResults: Partial<Record<JobCrawlPlatform, JobCrawlResult>> = {};
    const nextErrors: Partial<Record<JobCrawlPlatform, string>> = {};

    await Promise.all(
      selectedPlatforms.map(async (platform) => {
        try {
          crawlResults[platform] = await crawlPlatform(platform, listingUrls[platform], controller.signal);
        } catch (err) {
          nextErrors[platform] = getApiErrorMessage(err, `${PLATFORM_LABEL[platform]} crawl failed.`);
        }
      })
    );

    setPlatformErrors(nextErrors);

    const hadSuccess = selectedPlatforms.some((platform) => crawlResults[platform]);

    if (hadSuccess) {
      const freshJobs = flattenCrawlResults(crawlResults, selectedPlatforms);
      const savedAt = new Date().toISOString();

      setJobList(freshJobs);
      setCheckedJobKeys(new Set());
      setLastCrawledAt(savedAt);
      saveStoredJobCrawl({
        selectedPlatforms,
        listingUrls,
        jobs: freshJobs,
        savedAt,
      });
    }

    window.clearTimeout(timer);
    setCrawling(false);
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-xl shadow-slate-200/50 backdrop-blur-sm dark:border-white/[0.08] dark:bg-navy-900/80 dark:shadow-black/30 sm:p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Job discovery</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Select platforms, crawl, and browse one merged job list. Saved locally until the next crawl refreshes it.
        </p>
        {hydrated && lastCrawledAt ? <LastCrawledBanner iso={lastCrawledAt} /> : null}
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Platforms</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={selectAllPlatforms}
              disabled={crawling}
              className={platformButtonClass(allPlatformSelected)}
            >
              All
            </button>
            {ALL_JOB_CRAWL_PLATFORMS.map((platform) => (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                disabled={crawling}
                className={platformButtonClass(selectedPlatforms.includes(platform))}
              >
                {PLATFORM_LABEL[platform]}
              </button>
            ))}
          </div>
        </div>

        {selectedPlatforms.length < 2 ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {selectedPlatforms.length === 0
              ? "Select at least two platforms to crawl."
              : "Select at least one more platform to crawl."}
          </p>
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
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/25"
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

      {hydrated && jobList.length > 0 ? (
        <div className="mt-8 space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-800 dark:text-emerald-300">
              {jobList.length} job{jobList.length === 1 ? "" : "s"}
            </span>
            {checkedJobKeys.size > 0 ? (
              <span className="text-slate-500 dark:text-slate-400">
                {checkedJobKeys.size} selected
              </span>
            ) : null}
          </div>
          <MergedJobTable
            jobs={jobList}
            checkedKeys={checkedJobKeys}
            onToggleRow={toggleJobRow}
            onToggleAll={toggleAllJobs}
            allChecked={allJobsChecked}
          />
        </div>
      ) : null}
    </div>
  );
}
