"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/lib/auth-api";
import { crawlBuiltInJobs, crawlHiringCafeJobs, crawlWorkableJobs, crawlWorkingNomadsJobs } from "@/lib/builtin-crawl-api";
import {
  ALL_JOB_CRAWL_PLATFORMS,
  BUILTIN_CRAWL_TIMEOUT_MS,
  DEFAULT_LISTING_URLS,
  JOB_CRAWL_PLATFORM_LABEL,
  JOB_CRAWL_PLATFORM_VALIDATOR,
  mergeListingUrls,
  type DiscoveredJobRow,
  type JobCrawlPlatform,
  type JobCrawlResult,
} from "@/lib/builtin-crawl-types";
import { AUTH_LINKS } from "@/lib/constants";
import { formatEstDateTimeParts } from "@/lib/format-est-datetime";
import { flattenCrawlResults } from "@/lib/job-crawl-list";
import { loadStoredJobCrawl, saveStoredJobCrawl } from "@/lib/job-crawl-storage";
import { loadStoredProfile, resolveListingUrls } from "@/lib/user-profile";
import { ui } from "@/lib/ui-styles";

const filterInputClass = `${ui.input} py-3.5 text-base placeholder:text-slate-400 dark:placeholder:text-slate-500`;

const DEFAULT_JOB_TITLE_FILTER = "Engine OR Dev OR Scientist OR Specialist OR Architect";

type JobTableSortMode = "company" | "platform";

const SORT_MODE_OPTIONS: { value: JobTableSortMode; label: string; description: string }[] = [
  { value: "company", label: "Company name", description: "Sort A–Z and merge duplicate companies" },
  { value: "platform", label: "Platform order", description: "Original crawl order grouped by platform" },
];

const PLATFORM_LABEL = JOB_CRAWL_PLATFORM_LABEL;
const PLATFORM_DEFAULT_URL = DEFAULT_LISTING_URLS;
const PLATFORM_URL_VALID = JOB_CRAWL_PLATFORM_VALIDATOR;

const PLATFORM_TABLE_BADGE_CLASS: Record<JobCrawlPlatform, string> = {
  builtin: "bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/20",
  hiringcafe: "bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500/20",
  workable: "bg-amber-500/15 text-amber-800 dark:text-amber-300 ring-1 ring-amber-500/20",
  workingnomads: "bg-sky-500/15 text-sky-800 dark:text-sky-300 ring-1 ring-sky-500/20",
};

const PLATFORM_BLURB: Record<JobCrawlPlatform, string> = {
  builtin: "Remote tech roles from Built In",
  hiringcafe: "Cafe search listings",
  workable: "Workable job search",
  workingnomads: "Remote nomad listings",
};

function defaultSelectedPlatforms(): JobCrawlPlatform[] {
  return [...ALL_JOB_CRAWL_PLATFORMS];
}

function jobRowKey(job: DiscoveredJobRow, index: number): string {
  return `${job.platform}-${job.jobId}-${index}`;
}

function crawlPlatform(
  platform: JobCrawlPlatform,
  url: string,
  signal: AbortSignal
): Promise<JobCrawlResult> {
  if (platform === "builtin") return crawlBuiltInJobs(url, signal);
  if (platform === "hiringcafe") return crawlHiringCafeJobs(url, signal);
  if (platform === "workable") return crawlWorkableJobs(url, signal);
  return crawlWorkingNomadsJobs(url, signal);
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyUrlButton({
  url,
  disabled = false,
  title = "Copy URL",
}: {
  url: string;
  disabled?: boolean;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!url.trim() || disabled) return;
    const ok = await copyTextToClipboard(url);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      disabled={disabled || !url.trim()}
      className="shrink-0 self-stretch rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-orange-300 dark:hover:bg-orange-500/15"
      title={title}
    >
      {copied ? "Copied" : "Copy URL"}
    </button>
  );
}

function LastCrawledBanner({ iso }: { iso: string }) {
  const parts = formatEstDateTimeParts(iso);
  if (!parts) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-orange-500/20 bg-gradient-to-r from-orange-500/[0.08] via-amber-500/[0.06] to-sun-400/[0.08] shadow-sm dark:border-orange-400/15">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-600/15 text-orange-600 dark:bg-orange-400/15 dark:text-orange-300">
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
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-orange-700/80 dark:text-orange-300/80">
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
          <span className="inline-flex items-center rounded-full bg-orange-600/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-orange-700 dark:bg-orange-400/10 dark:text-orange-300">
            {parts.zone}
          </span>
        </div>
      </div>
    </div>
  );
}

function normalizeCompanyName(name: string | undefined | null): string {
  return (name ?? "").trim();
}

function companySortKey(name: string | undefined | null): string {
  const normalized = normalizeCompanyName(name);
  return normalized ? normalized.toLowerCase() : "\uffff";
}

type DisplayJobRow = {
  job: DiscoveredJobRow;
  originalIndex: number;
};

type CompanyJobGroup = {
  companyLabel: string;
  sortKey: string;
  rows: DisplayJobRow[];
};

type PlatformJobGroup = {
  platform: JobCrawlPlatform;
  rows: DisplayJobRow[];
};

function buildPlatformOrder(jobs: DiscoveredJobRow[]): JobCrawlPlatform[] {
  const order: JobCrawlPlatform[] = [];
  const seen = new Set<JobCrawlPlatform>();
  for (const job of jobs) {
    if (seen.has(job.platform)) continue;
    seen.add(job.platform);
    order.push(job.platform);
  }
  return order;
}

function platformOrderIndex(platform: JobCrawlPlatform, platformOrder: JobCrawlPlatform[]): number {
  const index = platformOrder.indexOf(platform);
  return index === -1 ? ALL_JOB_CRAWL_PLATFORMS.indexOf(platform) : index;
}

function buildCompanyGroups(rows: DisplayJobRow[]): CompanyJobGroup[] {
  const sorted = [...rows].sort((a, b) => {
    const byCompany = companySortKey(a.job.companyName).localeCompare(companySortKey(b.job.companyName));
    if (byCompany !== 0) return byCompany;
    return a.originalIndex - b.originalIndex;
  });

  const groups: CompanyJobGroup[] = [];
  for (const row of sorted) {
    const sortKey = companySortKey(row.job.companyName);
    const companyLabel = normalizeCompanyName(row.job.companyName) || "—";
    const last = groups[groups.length - 1];
    if (last && last.sortKey === sortKey) {
      last.rows.push(row);
    } else {
      groups.push({ companyLabel, sortKey, rows: [row] });
    }
  }
  return groups;
}

function buildPlatformGroups(rows: DisplayJobRow[], platformOrder: JobCrawlPlatform[]): PlatformJobGroup[] {
  const sorted = [...rows].sort((a, b) => {
    const byPlatform =
      platformOrderIndex(a.job.platform, platformOrder) - platformOrderIndex(b.job.platform, platformOrder);
    if (byPlatform !== 0) return byPlatform;
    return a.originalIndex - b.originalIndex;
  });

  const groups: PlatformJobGroup[] = [];
  for (const row of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.platform === row.job.platform) {
      last.rows.push(row);
    } else {
      groups.push({ platform: row.job.platform, rows: [row] });
    }
  }
  return groups;
}

function stripFilterTerm(term: string): string {
  const trimmed = term.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function parseTitleFilter(filter: string): { operator: "or" | "and" | "single"; terms: string[] } {
  const trimmed = filter.trim();
  if (!trimmed) return { operator: "single", terms: [] };

  const orParts = trimmed.split(/\s+OR\s+/i).map(stripFilterTerm).filter(Boolean);
  if (orParts.length > 1) return { operator: "or", terms: orParts };

  const andParts = trimmed.split(/\s+AND\s+/i).map(stripFilterTerm).filter(Boolean);
  if (andParts.length > 1) return { operator: "and", terms: andParts };

  return { operator: "single", terms: [stripFilterTerm(trimmed)].filter(Boolean) };
}

function jobTitleMatchesFilter(title: string | undefined | null, filter: string): boolean {
  const parsed = parseTitleFilter(filter);
  if (parsed.terms.length === 0) return true;

  const normalizedTitle = (title ?? "").toLowerCase();
  const normalizedTerms = parsed.terms.map((term) => term.toLowerCase());

  if (parsed.operator === "or") {
    return normalizedTerms.some((term) => normalizedTitle.includes(term));
  }
  if (parsed.operator === "and") {
    return normalizedTerms.every((term) => normalizedTitle.includes(term));
  }
  return normalizedTitle.includes(normalizedTerms[0]);
}

function JobTableSortDropdown({
  value,
  onChange,
}: {
  value: JobTableSortMode;
  onChange: (mode: JobTableSortMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = SORT_MODE_OPTIONS.find((option) => option.value === value) ?? SORT_MODE_OPTIONS[0];

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0 w-full sm:w-[15.5rem]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left shadow-sm transition-all hover:border-orange-400/40 hover:shadow-md focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-white/[0.10] dark:bg-white/[0.03] dark:hover:border-orange-400/30"
      >
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            Sort by
          </span>
          <span className="block truncate text-base font-semibold text-slate-900 dark:text-white">
            {selected.label}
          </span>
        </span>
        <svg
          className={`h-5 w-5 shrink-0 text-orange-600 transition-transform dark:text-orange-400 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label="Sort jobs by"
          className="absolute right-0 z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl shadow-slate-200/60 dark:border-white/[0.10] dark:bg-warm-900 dark:shadow-black/40"
        >
          {SORT_MODE_OPTIONS.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors ${
                    active
                      ? "bg-orange-500/10 text-orange-800 dark:bg-orange-400/10 dark:text-orange-200"
                      : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="text-base font-semibold">{option.label}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">{option.description}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function filterJobsByTitle(jobs: DiscoveredJobRow[], titleFilter: string): DisplayJobRow[] {
  const trimmed = titleFilter.trim();
  return jobs
    .map((job, originalIndex) => ({ job, originalIndex }))
    .filter(({ job }) => !trimmed || jobTitleMatchesFilter(job.jobTitle, trimmed));
}

function MergedJobTable({
  rows,
  sortMode,
  platformOrder,
  checkedKeys,
  onToggleRow,
  onToggleAll,
  allChecked,
  emptyMessage,
}: {
  rows: DisplayJobRow[];
  sortMode: JobTableSortMode;
  platformOrder: JobCrawlPlatform[];
  checkedKeys: Set<string>;
  onToggleRow: (key: string) => void;
  onToggleAll: () => void;
  allChecked: boolean;
  emptyMessage?: string;
}) {
  const companyGroups = useMemo(() => buildCompanyGroups(rows), [rows]);
  const platformGroups = useMemo(
    () => buildPlatformGroups(rows, platformOrder),
    [rows, platformOrder]
  );

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
        {emptyMessage ?? "Crawl finished but no jobs were returned."}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/[0.08]">
      <table className="min-w-full text-base">
        <thead className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3 font-semibold whitespace-nowrap">Company name</th>
            <th className="px-4 py-3 font-semibold min-w-[12rem]">Job title</th>
            <th className="px-4 py-3 font-semibold min-w-[10rem]">Job URL</th>
            <th className="px-4 py-3 font-semibold whitespace-nowrap">Platform</th>
            <th className="px-4 py-3 font-semibold text-center w-12">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={onToggleAll}
                aria-label="Select all jobs"
                className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500/30 dark:border-white/20 dark:bg-white/5"
              />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
          {sortMode === "company"
            ? companyGroups.map((group) =>
                group.rows.map((row, rowIndex) => {
                  const key = jobRowKey(row.job, row.originalIndex);
                  const checked = checkedKeys.has(key);

                  return (
                    <tr
                      key={key}
                      className={
                        checked
                          ? "bg-orange-500/[0.06] hover:bg-orange-500/[0.08]"
                          : "hover:bg-slate-50/80 dark:hover:bg-white/[0.02]"
                      }
                    >
                      {rowIndex === 0 ? (
                        <td
                          rowSpan={group.rows.length}
                          className="px-4 py-3 align-middle font-medium text-slate-900 dark:text-white whitespace-nowrap border-r border-slate-100 dark:border-white/[0.06]"
                        >
                          {group.companyLabel}
                        </td>
                      ) : null}
                      <td className="px-4 py-3 text-slate-800 dark:text-slate-100">{row.job.jobTitle || "—"}</td>
                      <td className="px-4 py-3 max-w-[20rem]">
                        {row.job.jobUrl ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <span title={row.job.jobUrl} className="truncate text-orange-600 dark:text-orange-400 select-all">
                              {row.job.jobUrl}
                            </span>
                            <CopyUrlButton url={row.job.jobUrl} />
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${PLATFORM_TABLE_BADGE_CLASS[row.job.platform]}`}
                        >
                          {PLATFORM_LABEL[row.job.platform]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleRow(key)}
                          aria-label={`Select ${row.job.jobTitle || "job"}`}
                          className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500/30 dark:border-white/20 dark:bg-white/5"
                        />
                      </td>
                    </tr>
                  );
                })
              )
            : platformGroups.map((group) =>
                group.rows.map((row, rowIndex) => {
                  const key = jobRowKey(row.job, row.originalIndex);
                  const checked = checkedKeys.has(key);

                  return (
                    <tr
                      key={key}
                      className={
                        checked
                          ? "bg-orange-500/[0.06] hover:bg-orange-500/[0.08]"
                          : "hover:bg-slate-50/80 dark:hover:bg-white/[0.02]"
                      }
                    >
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                        {normalizeCompanyName(row.job.companyName) || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-800 dark:text-slate-100">{row.job.jobTitle || "—"}</td>
                      <td className="px-4 py-3 max-w-[20rem]">
                        {row.job.jobUrl ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <span title={row.job.jobUrl} className="truncate text-orange-600 dark:text-orange-400 select-all">
                              {row.job.jobUrl}
                            </span>
                            <CopyUrlButton url={row.job.jobUrl} />
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      {rowIndex === 0 ? (
                        <td
                          rowSpan={group.rows.length}
                          className="px-4 py-3 align-middle whitespace-nowrap border-l border-slate-100 dark:border-white/[0.06]"
                        >
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${PLATFORM_TABLE_BADGE_CLASS[group.platform]}`}
                          >
                            {PLATFORM_LABEL[group.platform]}
                          </span>
                        </td>
                      ) : null}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleRow(key)}
                          aria-label={`Select ${row.job.jobTitle || "job"}`}
                          className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500/30 dark:border-white/20 dark:bg-white/5"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
        </tbody>
      </table>
    </div>
  );
}

export default function BuiltInCrawlPanel() {
  const { user } = useAuth();
  const userId = user?.id;
  const profileListingUrls = useMemo(
    () => resolveListingUrls(user, userId ? loadStoredProfile(userId) : null),
    [user, userId]
  );

  const [selectedPlatforms, setSelectedPlatforms] = useState<JobCrawlPlatform[]>(defaultSelectedPlatforms);
  const [listingUrls, setListingUrls] = useState<Record<JobCrawlPlatform, string>>(() =>
    mergeListingUrls(null)
  );
  const [jobList, setJobList] = useState<DiscoveredJobRow[]>([]);
  const [checkedJobKeys, setCheckedJobKeys] = useState<Set<string>>(() => new Set());
  const [jobTitleFilter, setJobTitleFilter] = useState(DEFAULT_JOB_TITLE_FILTER);
  const [jobTableSortMode, setJobTableSortMode] = useState<JobTableSortMode>("company");
  const [platformErrors, setPlatformErrors] = useState<Partial<Record<JobCrawlPlatform, string>>>({});
  const [crawling, setCrawling] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [lastCrawledAt, setLastCrawledAt] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadStoredJobCrawl(userId);
    // Profile listing URLs are the source of truth; session only keeps jobs + platforms.
    setListingUrls(mergeListingUrls(profileListingUrls ?? stored?.listingUrls));
    if (stored) {
      setSelectedPlatforms(stored.selectedPlatforms);
      setJobList(stored.jobs);
      if (stored.savedAt) setLastCrawledAt(stored.savedAt);
    }
    setHydrated(true);
  }, [userId, profileListingUrls]);

  const allPlatformSelected = ALL_JOB_CRAWL_PLATFORMS.every((p) => selectedPlatforms.includes(p));
  const canCrawl =
    !crawling &&
    selectedPlatforms.length > 0 &&
    selectedPlatforms.every((p) => {
      const url = listingUrls[p]?.trim() ?? "";
      return url.length > 0 && PLATFORM_URL_VALID[p](url);
    });

  const filteredJobRows = useMemo(
    () => filterJobsByTitle(jobList, jobTitleFilter),
    [jobList, jobTitleFilter]
  );
  const hasTitleFilter = jobTitleFilter.trim().length > 0;
  const crawlPlatformOrder = useMemo(() => buildPlatformOrder(jobList), [jobList]);

  const allJobsChecked = useMemo(() => {
    if (filteredJobRows.length === 0) return false;
    return filteredJobRows.every(({ job, originalIndex }) =>
      checkedJobKeys.has(jobRowKey(job, originalIndex))
    );
  }, [filteredJobRows, checkedJobKeys]);

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
        const profileUrl = profileListingUrls?.[platform]?.trim();
        setListingUrls((urls) => ({
          ...urls,
          [platform]: profileUrl || PLATFORM_DEFAULT_URL[platform],
        }));
      }
      return [...current, platform];
    });
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
      setCheckedJobKeys((current) => {
        const next = new Set(current);
        for (const { job, originalIndex } of filteredJobRows) {
          next.delete(jobRowKey(job, originalIndex));
        }
        return next;
      });
      return;
    }
    setCheckedJobKeys((current) => {
      const next = new Set(current);
      for (const { job, originalIndex } of filteredJobRows) {
        next.add(jobRowKey(job, originalIndex));
      }
      return next;
    });
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
      saveStoredJobCrawl(
        {
          selectedPlatforms,
          listingUrls,
          jobs: freshJobs,
          savedAt,
        },
        userId
      );
    }

    window.clearTimeout(timer);
    setCrawling(false);
  }

  return (
    <div className={ui.card}>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Job discovery</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Choose platforms, crawl, and browse one merged job list. Crawl links are saved on your{" "}
          <Link
            href={`${AUTH_LINKS.dashboard}#crawl-urls`}
            className="font-semibold text-orange-700 underline-offset-2 hover:underline dark:text-orange-300"
          >
            profile dashboard
          </Link>
          .
        </p>
        {hydrated && lastCrawledAt ? <LastCrawledBanner iso={lastCrawledAt} /> : null}
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Platforms</p>
          <button
            type="button"
            onClick={selectAllPlatforms}
            disabled={crawling || allPlatformSelected}
            className="text-sm font-semibold text-orange-700 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40 dark:text-orange-300"
          >
            Select all
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Crawl platforms">
          {ALL_JOB_CRAWL_PLATFORMS.map((platform) => {
            const checked = selectedPlatforms.includes(platform);
            const inputId = `crawl-platform-${platform}`;
            return (
              <label
                key={platform}
                htmlFor={inputId}
                className={`group relative flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3.5 transition-all ${
                  checked
                    ? "border-orange-500/45 bg-orange-500/[0.10] shadow-sm shadow-orange-500/10 dark:border-orange-400/40 dark:bg-orange-500/[0.12]"
                    : "border-slate-200 bg-white/70 hover:border-orange-300/60 hover:bg-orange-50/50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-orange-500/25 dark:hover:bg-white/[0.05]"
                } ${crawling ? "pointer-events-none opacity-60" : ""}`}
              >
                <input
                  id={inputId}
                  type="checkbox"
                  checked={checked}
                  disabled={crawling}
                  onChange={() => togglePlatform(platform)}
                  className="sr-only"
                />
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                    checked
                      ? "border-orange-500 bg-orange-500 text-white"
                      : "border-slate-300 bg-white dark:border-white/25 dark:bg-transparent"
                  }`}
                  aria-hidden
                >
                  {checked ? (
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                    {PLATFORM_LABEL[platform]}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                    {PLATFORM_BLURB[platform]}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        {selectedPlatforms.length === 0 ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Select at least one platform to crawl.
          </p>
        ) : null}

        <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-start sm:items-center">
          <button
            type="button"
            onClick={() => void handleCrawl()}
            disabled={!canCrawl}
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-tomato-600 via-orange-500 to-sun-400 hover:from-tomato-500 hover:via-orange-400 hover:to-sun-300 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-orange-500/25"
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
          <div className="flex flex-wrap items-center gap-3 text-base">
            <span className="inline-flex items-center rounded-full bg-orange-500/10 px-3.5 py-1.5 font-semibold text-orange-800 dark:text-orange-300">
              {hasTitleFilter
                ? `${filteredJobRows.length} of ${jobList.length} job${jobList.length === 1 ? "" : "s"}`
                : `${jobList.length} job${jobList.length === 1 ? "" : "s"}`}
            </span>
            {checkedJobKeys.size > 0 ? (
              <span className="text-slate-500 dark:text-slate-400">
                {checkedJobKeys.size} selected
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <label htmlFor="jobTitleFilter" className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                Job title filter
              </label>
              <input
                id="jobTitleFilter"
                type="search"
                value={jobTitleFilter}
                onChange={(e) => setJobTitleFilter(e.target.value)}
                placeholder={DEFAULT_JOB_TITLE_FILTER}
                className={filterInputClass}
                spellCheck={false}
              />
              <p className="mt-1.5 text-sm text-slate-400 dark:text-slate-500">
                Use <span className="font-semibold text-slate-500 dark:text-slate-400">OR</span> to match any term, or{" "}
                <span className="font-semibold text-slate-500 dark:text-slate-400">AND</span> to require every term.
              </p>
            </div>
            <div className="sm:pt-7">
              <JobTableSortDropdown value={jobTableSortMode} onChange={setJobTableSortMode} />
            </div>
          </div>

          <MergedJobTable
            rows={filteredJobRows}
            sortMode={jobTableSortMode}
            platformOrder={crawlPlatformOrder}
            checkedKeys={checkedJobKeys}
            onToggleRow={toggleJobRow}
            onToggleAll={toggleAllJobs}
            allChecked={allJobsChecked}
            emptyMessage={
              hasTitleFilter ? "No jobs match this job title filter." : undefined
            }
          />
        </div>
      ) : null}
    </div>
  );
}
