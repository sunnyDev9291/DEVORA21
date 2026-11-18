"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/lib/auth-api";
import {
  crawlBuiltInJobs,
  crawlGetOnBoardJobs,
  crawlHiringCafeJobs,
  crawlHimalayasJobs,
  crawlJobgetherJobs,
  crawlJobicyJobs,
  crawlWorkableJobs,
  crawlWorkingNomadsJobs,
} from "@/lib/builtin-crawl-api";
import {
  ALL_JOB_CRAWL_PLATFORMS,
  BUILTIN_CRAWL_TIMEOUT_MS,
  DEFAULT_JOB_CRAWL_POSTED_WITHIN,
  DEFAULT_LISTING_URLS,
  JOB_CRAWL_PLATFORM_LABEL,
  JOB_CRAWL_PLATFORM_VALIDATOR,
  JOB_CRAWL_POSTED_WITHIN_OPTIONS,
  mergeListingUrls,
  normalizePostedWithin,
  postedWithinLabel,
  type DiscoveredJobRow,
  type JobCrawlPlatform,
  type JobCrawlPostedWithin,
  type JobCrawlResult,
} from "@/lib/builtin-crawl-types";
import { AUTH_LINKS } from "@/lib/constants";
import { formatEstDateTimeParts } from "@/lib/format-est-datetime";
import { flattenCrawlResults } from "@/lib/job-crawl-list";
import { diffCrawlJobs } from "@/lib/job-crawl-diff";
import {
  buildCrawlCompanyBadgeMap,
  buildCrawlResumeMatchIndex,
  companyBadgeKey,
  countCrawlCompanyBadges,
  crawlResumeBadgeLabel,
  crawlResumeBadgeRank,
  filterArchivesByCompany,
  type CrawlJobResumeBadge,
} from "@/lib/job-crawl-resume-badge";
import { loadStoredJobCrawl, saveStoredJobCrawl } from "@/lib/job-crawl-storage";
import { listSavedResumesCached } from "@/lib/saved-resumes-cache";
import type { SavedResumeArchive } from "@/lib/saved-resumes-types";
import {
  DEFAULT_JOB_SHEET_COUNTRY,
  JOB_SHEET_COUNTRIES,
  type JobSheetCountry,
} from "@/lib/job-sheet-countries";
import { loadStoredProfile, resolveListingUrls } from "@/lib/user-profile";
import { ui } from "@/lib/ui-styles";

const SHEET_COUNTRY_STORAGE_KEY = "dv21:job-crawl-sheet-country";

const filterInputClass = `${ui.input} py-3.5 text-base placeholder:text-slate-400 dark:placeholder:text-slate-500`;

const DEFAULT_JOB_TITLE_FILTER = "Engine OR Dev OR Scientist OR Specialist OR Architect";

/** Companies shown per results page (pagination is by company, not by job row). */
const COMPANIES_PER_PAGE = 25;

type PlatformCrawlStatus = "pending" | "crawling" | "done" | "error";

type PlatformCrawlProgress = {
  status: PlatformCrawlStatus;
  jobCount?: number;
  message?: string;
};

const PLATFORM_LABEL = JOB_CRAWL_PLATFORM_LABEL;
const PLATFORM_DEFAULT_URL = DEFAULT_LISTING_URLS;
const PLATFORM_URL_VALID = JOB_CRAWL_PLATFORM_VALIDATOR;

const PLATFORM_TABLE_BADGE_CLASS: Record<JobCrawlPlatform, string> = {
  builtin: "bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/20",
  hiringcafe: "bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500/20",
  workable: "bg-amber-500/15 text-amber-800 dark:text-amber-300 ring-1 ring-amber-500/20",
  workingnomads: "bg-sky-500/15 text-sky-800 dark:text-sky-300 ring-1 ring-sky-500/20",
  himalayas: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/20",
  getonboard: "bg-rose-500/15 text-rose-800 dark:text-rose-300 ring-1 ring-rose-500/20",
  jobicy: "bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 ring-1 ring-indigo-500/20",
  jobgether: "bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-300 ring-1 ring-fuchsia-500/20",
};

const PLATFORM_BLURB: Record<JobCrawlPlatform, string> = {
  builtin: "Remote tech roles from Built In",
  hiringcafe: "Cafe search listings",
  workable: "Workable job search",
  workingnomads: "Remote nomad listings",
  himalayas: "Remote roles via Himalayas free API (country filter)",
  getonboard: "Remote roles via Get on Board (country filter, last 24 hours)",
  jobicy: "Remote roles via Jobicy free API (country filter, last 24 hours)",
  jobgether: "Full-remote roles via Jobgether (country filter, last 24 hours)",
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
  signal: AbortSignal,
  postedWithin: JobCrawlPostedWithin
): Promise<JobCrawlResult> {
  if (platform === "builtin") return crawlBuiltInJobs(url, signal, postedWithin);
  if (platform === "hiringcafe") return crawlHiringCafeJobs(url, signal, postedWithin);
  if (platform === "workable") return crawlWorkableJobs(url, signal, postedWithin);
  if (platform === "workingnomads") return crawlWorkingNomadsJobs(url, signal, postedWithin);
  if (platform === "getonboard") return crawlGetOnBoardJobs(url, signal, postedWithin);
  if (platform === "jobicy") return crawlJobicyJobs(url, signal, postedWithin);
  if (platform === "jobgether") return crawlJobgetherJobs(url, signal, postedWithin);
  return crawlHimalayasJobs(url, signal, postedWithin);
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
  companyKey: string;
  badge: CrawlJobResumeBadge;
  sortKey: string;
  rows: DisplayJobRow[];
};

/** Sort good → possible → bad, then company A–Z within each badge. */
function buildCompanyGroups(
  rows: DisplayJobRow[],
  getBadge: (companyName: string | undefined | null) => CrawlJobResumeBadge
): CompanyJobGroup[] {
  const sorted = [...rows].sort((a, b) => {
    const byBadge =
      crawlResumeBadgeRank(getBadge(a.job.companyName)) -
      crawlResumeBadgeRank(getBadge(b.job.companyName));
    if (byBadge !== 0) return byBadge;
    const byCompany = companySortKey(a.job.companyName).localeCompare(
      companySortKey(b.job.companyName)
    );
    if (byCompany !== 0) return byCompany;
    return a.originalIndex - b.originalIndex;
  });

  const groups: CompanyJobGroup[] = [];
  for (const row of sorted) {
    const badge = getBadge(row.job.companyName);
    const companyKey = companyBadgeKey(row.job.companyName);
    const sortKey = `${crawlResumeBadgeRank(badge)}:${companySortKey(row.job.companyName)}`;
    const companyLabel = normalizeCompanyName(row.job.companyName) || "—";
    const last = groups[groups.length - 1];
    if (last && last.sortKey === sortKey) {
      last.rows.push(row);
    } else {
      groups.push({ companyLabel, companyKey, badge, sortKey, rows: [row] });
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

function filterJobsByTitle(jobs: DiscoveredJobRow[], titleFilter: string): DisplayJobRow[] {
  const trimmed = titleFilter.trim();
  return jobs
    .map((job, originalIndex) => ({ job, originalIndex }))
    .filter(({ job }) => !trimmed || jobTitleMatchesFilter(job.jobTitle, trimmed));
}

function JobSelectCheckbox({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  return (
    <label
      className="job-select-check"
      data-checked={checked ? "true" : "false"}
      onClick={(event) => event.stopPropagation()}
    >
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={ariaLabel} />
      <span className="job-select-box" aria-hidden="true">
        <svg className="job-select-mark" viewBox="0 0 20 20" fill="none">
          <path
            d="M4.5 10.5l3.2 3.2 7.8-7.8"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </label>
  );
}

function ResumeFitBadge({ badge }: { badge: CrawlJobResumeBadge }) {
  const label = crawlResumeBadgeLabel(badge);
  const className =
    badge === "good"
      ? "bg-emerald-500 shadow-emerald-500/30"
      : badge === "possible"
        ? "bg-amber-500 shadow-amber-500/30"
        : "bg-rose-500 shadow-rose-500/30";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm ${className}`}
    >
      {label}
    </span>
  );
}

function formatPostedAt(iso?: string): string | null {
  if (!iso?.trim()) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function JobTitleCell({ title, postedAt }: { title: string; postedAt?: string }) {
  const postedLabel = formatPostedAt(postedAt);
  return (
    <div className="min-w-0">
      <span>{title || "—"}</span>
      {postedLabel ? (
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Posted {postedLabel}</p>
      ) : null}
    </div>
  );
}

type JobRowContextMenuState = {
  x: number;
  y: number;
  companyName: string;
  companyLabel: string;
};

function JobRowContextMenu({
  menu,
  onClose,
  onSavedRecord,
}: {
  menu: JobRowContextMenuState;
  onClose: () => void;
  onSavedRecord: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    function handleScroll() {
      onClose();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose]);

  const menuWidth = 180;
  const menuHeight = 48;
  const left = Math.min(menu.x, Math.max(8, window.innerWidth - menuWidth - 8));
  const top = Math.min(menu.y, Math.max(8, window.innerHeight - menuHeight - 8));

  return createPortal(
    <div
      ref={rootRef}
      role="menu"
      aria-label={`Actions for ${menu.companyLabel}`}
      className="fixed z-[90] min-w-[11rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-300/50 dark:border-white/[0.12] dark:bg-warm-900 dark:shadow-black/50"
      style={{ left, top }}
    >
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center px-3.5 py-2.5 text-left text-sm font-semibold text-slate-800 transition-colors hover:bg-orange-500/10 hover:text-orange-800 dark:text-slate-100 dark:hover:bg-orange-400/10 dark:hover:text-orange-200"
        onClick={() => {
          onSavedRecord();
          onClose();
        }}
      >
        Saved record
      </button>
    </div>,
    document.body
  );
}

function CompanySavedArchivesDialog({
  open,
  companyLabel,
  archives,
  loading,
  onClose,
}: {
  open: boolean;
  companyLabel: string;
  archives: SavedResumeArchive[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Saved records · ${companyLabel || "Company"}`}
      className="max-w-2xl"
      priority
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading saved records…</p>
        ) : archives.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-300">
            No saved resume archives for this company.
          </p>
        ) : (
          <ul className="space-y-3">
            {archives.map((archive) => {
              const bidParts = formatEstDateTimeParts(archive.bidAt);
              return (
                <li
                  key={archive.id}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.03]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {archive.jobTitle || "—"}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                        {archive.companyName || companyLabel}
                        {archive.platform ? ` · ${archive.platform}` : ""}
                      </p>
                    </div>
                    {bidParts ? (
                      <time
                        dateTime={archive.bidAt}
                        className="shrink-0 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400"
                      >
                        {bidParts.combined}
                      </time>
                    ) : null}
                  </div>
                  <p className="mt-2 truncate text-sm text-slate-600 dark:text-slate-300">
                    {archive.resumeFileName || "Resume"}
                  </p>
                  {archive.jobUrl ? (
                    <a
                      href={archive.jobUrl.startsWith("http") ? archive.jobUrl : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`mt-1 block truncate text-sm ${
                        archive.jobUrl.startsWith("http")
                          ? "text-orange-600 hover:underline dark:text-orange-400"
                          : "text-slate-400"
                      }`}
                      title={archive.jobUrl}
                      onClick={(event) => {
                        if (!archive.jobUrl?.startsWith("http")) event.preventDefault();
                      }}
                    >
                      {archive.jobUrl}
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function CompanyPagination({
  page,
  totalPages,
  totalCompanies,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalCompanies: number;
  onPageChange: (page: number) => void;
}) {
  if (totalCompanies === 0) return null;

  const from = (page - 1) * COMPANIES_PER_PAGE + 1;
  const to = Math.min(page * COMPANIES_PER_PAGE, totalCompanies);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.02]">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Companies <span className="font-semibold tabular-nums">{from}</span>–
        <span className="font-semibold tabular-nums">{to}</span> of{" "}
        <span className="font-semibold tabular-nums">{totalCompanies}</span>
        <span className="text-slate-400 dark:text-slate-500"> · {COMPANIES_PER_PAGE}/page</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-orange-400/40 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.10] dark:bg-white/[0.03] dark:text-slate-200"
        >
          Prev
        </button>
        <span className="min-w-[5.5rem] text-center text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-orange-400/40 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.10] dark:bg-white/[0.03] dark:text-slate-200"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function FixedSheetControls({
  sheetCountry,
  onCountryChange,
  onAddToSheet,
  addingToSheet,
  selectedCount,
}: {
  sheetCountry: JobSheetCountry;
  onCountryChange: (value: JobSheetCountry) => void;
  onAddToSheet: () => void;
  addingToSheet: boolean;
  selectedCount: number;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Portal to body so parent overflow/transform cannot break viewport `position: fixed`.
  return createPortal(
    <div
      className="pointer-events-none fixed inset-y-0 right-0 z-[80] flex items-end justify-end p-3 sm:items-center sm:p-5"
      aria-live="polite"
    >
      <div className="pointer-events-auto w-[min(100vw-1.5rem,15.5rem)] rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-xl shadow-slate-300/40 backdrop-blur-md dark:border-white/[0.12] dark:bg-warm-900/95 dark:shadow-black/50">
        <div className="space-y-3">
          <div>
            <label
              htmlFor="jobSheetCountry"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500"
            >
              Sheet country
            </label>
            <select
              id="jobSheetCountry"
              value={sheetCountry}
              onChange={(e) => onCountryChange(e.target.value as JobSheetCountry)}
              className={`${ui.input} py-2.5 text-sm`}
            >
              {JOB_SHEET_COUNTRIES.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={onAddToSheet}
            disabled={addingToSheet || selectedCount === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {addingToSheet ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Adding…
              </>
            ) : (
              <>Add Sheet{selectedCount > 0 ? ` (${selectedCount})` : ""}</>
            )}
          </button>
          <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            Check jobs, pick the sheet tab country, then add rows.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

function MergedJobTable({
  groups,
  companyNumberStart,
  checkedKeys,
  onToggleRow,
  onToggleAll,
  allChecked,
  onRowContextMenu,
  emptyMessage,
}: {
  groups: CompanyJobGroup[];
  /** 1-based company number for the first group on this page. */
  companyNumberStart: number;
  checkedKeys: Set<string>;
  onToggleRow: (key: string) => void;
  onToggleAll: () => void;
  allChecked: boolean;
  onRowContextMenu: (
    event: ReactMouseEvent<HTMLTableRowElement>,
    job: DiscoveredJobRow,
    companyLabel: string
  ) => void;
  emptyMessage?: string;
}) {
  const [flashKeys, setFlashKeys] = useState<Set<string>>(() => new Set());
  const flashTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = flashTimersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  function flashRow(key: string) {
    setFlashKeys((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
    const existing = flashTimersRef.current.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setFlashKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
      flashTimersRef.current.delete(key);
    }, 420);
    flashTimersRef.current.set(key, timer);
  }

  function handleToggleRow(key: string) {
    flashRow(key);
    onToggleRow(key);
  }

  function handleRowClick(event: ReactMouseEvent<HTMLTableRowElement>, key: string) {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest("a, button, input, label, [data-no-row-toggle]")) return;
    handleToggleRow(key);
  }

  if (groups.length === 0) {
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
            <th className="px-2 py-3 font-semibold text-center w-14">
              <JobSelectCheckbox
                checked={allChecked}
                onChange={onToggleAll}
                ariaLabel="Select all jobs on this page"
              />
            </th>
            <th className="px-2 py-3 font-semibold text-center w-12 whitespace-nowrap">#</th>
            <th className="px-4 py-3 font-semibold whitespace-nowrap">Company name</th>
            <th className="px-4 py-3 font-semibold min-w-[12rem]">Job title</th>
            <th className="px-4 py-3 font-semibold min-w-[10rem]">Job URL</th>
            <th className="px-4 py-3 font-semibold whitespace-nowrap">Platform</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
          {groups.map((group, groupIndex) => {
            const companyNumber = companyNumberStart + groupIndex;
            return group.rows.map((row, rowIndex) => {
              const key = jobRowKey(row.job, row.originalIndex);
              const checked = checkedKeys.has(key);
              const flashing = flashKeys.has(key);

              return (
                <tr
                  key={key}
                  data-checked={checked ? "true" : "false"}
                  className={`job-select-row ${flashing ? "is-flashing" : ""}`}
                  onClick={(event) => handleRowClick(event, key)}
                  onContextMenu={(event) => onRowContextMenu(event, row.job, group.companyLabel)}
                >
                  <td className="px-2 py-2.5 text-center align-middle">
                    <JobSelectCheckbox
                      checked={checked}
                      onChange={() => handleToggleRow(key)}
                      ariaLabel={`Select ${row.job.jobTitle || "job"}`}
                    />
                  </td>
                  {rowIndex === 0 ? (
                    <td
                      rowSpan={group.rows.length}
                      className="px-2 py-3 align-middle text-center tabular-nums text-sm font-semibold text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-white/[0.06]"
                    >
                      {companyNumber}
                    </td>
                  ) : null}
                  {rowIndex === 0 ? (
                    <td
                      rowSpan={group.rows.length}
                      className="px-4 py-3 align-middle font-medium text-slate-900 dark:text-white whitespace-nowrap border-r border-slate-100 dark:border-white/[0.06]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <ResumeFitBadge badge={group.badge} />
                        <span>{group.companyLabel}</span>
                      </div>
                    </td>
                  ) : null}
                  <td className="px-4 py-3 text-slate-800 dark:text-slate-100">
                    <JobTitleCell title={row.job.jobTitle} postedAt={row.job.postedAt} />
                  </td>
                  <td className="px-4 py-3 max-w-[20rem]">
                    {row.job.jobUrl ? (
                      <div className="flex items-center gap-2 min-w-0" data-no-row-toggle>
                        <a
                          href={row.job.jobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={row.job.jobUrl}
                          className="truncate text-orange-600 hover:underline dark:text-orange-400 select-all"
                          data-no-row-toggle
                        >
                          {row.job.jobUrl}
                        </a>
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
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function BuiltInCrawlPanel() {
  const { user } = useAuth();
  const userId = user?.id;
  const profileListingKey = useMemo(() => {
    const urls = resolveListingUrls(user, userId ? loadStoredProfile(userId) : null);
    if (!urls) return "";
    return ALL_JOB_CRAWL_PLATFORMS.map((platform) => `${platform}:${urls[platform] ?? ""}`).join("|");
  }, [user, userId]);
  const profileListingUrls = useMemo(() => {
    if (!profileListingKey) return undefined;
    return resolveListingUrls(user, userId ? loadStoredProfile(userId) : null);
    // profileListingKey already captures listing URL contents
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: stabilize on content, not user identity
  }, [profileListingKey, userId]);

  const [selectedPlatforms, setSelectedPlatforms] = useState<JobCrawlPlatform[]>(defaultSelectedPlatforms);
  const [listingUrls, setListingUrls] = useState<Record<JobCrawlPlatform, string>>(() =>
    mergeListingUrls(null)
  );
  const [postedWithin, setPostedWithin] = useState<JobCrawlPostedWithin>(DEFAULT_JOB_CRAWL_POSTED_WITHIN);
  const [resultPostedWithin, setResultPostedWithin] = useState<JobCrawlPostedWithin | null>(null);
  const [jobList, setJobList] = useState<DiscoveredJobRow[]>([]);
  const [checkedJobKeys, setCheckedJobKeys] = useState<Set<string>>(() => new Set());
  const [jobTitleFilter, setJobTitleFilter] = useState(DEFAULT_JOB_TITLE_FILTER);
  const [companyPage, setCompanyPage] = useState(1);
  const [platformErrors, setPlatformErrors] = useState<Partial<Record<JobCrawlPlatform, string>>>({});
  const [crawling, setCrawling] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState<
    Partial<Record<JobCrawlPlatform, PlatformCrawlProgress>>
  >({});
  const [hydrated, setHydrated] = useState(false);
  const [lastCrawledAt, setLastCrawledAt] = useState<string | null>(null);
  const [sheetCountry, setSheetCountry] = useState<JobSheetCountry>(DEFAULT_JOB_SHEET_COUNTRY);
  const [addingToSheet, setAddingToSheet] = useState(false);
  const [sheetFeedback, setSheetFeedback] = useState<{ tone: "ok" | "err"; text: string } | null>(
    null
  );
  const [badgeByCompany, setBadgeByCompany] = useState<Map<string, CrawlJobResumeBadge>>(
    () => new Map()
  );
  const [resumeArchives, setResumeArchives] = useState<SavedResumeArchive[]>([]);
  const [rowContextMenu, setRowContextMenu] = useState<JobRowContextMenuState | null>(null);
  const [savedRecordsDialog, setSavedRecordsDialog] = useState<{
    companyName: string;
    companyLabel: string;
  } | null>(null);
  const [savedRecordsLoading, setSavedRecordsLoading] = useState(false);
  const [crawlDiff, setCrawlDiff] = useState<{ added: number; removed: number } | null>(null);
  const hydratedUserIdRef = useRef<string | undefined>(undefined);

  async function refreshResumeFitBadges(jobs: DiscoveredJobRow[], forceArchives = false) {
    if (jobs.length === 0) {
      setBadgeByCompany(new Map());
      setResumeArchives([]);
      return;
    }
    try {
      const archives = await listSavedResumesCached({ force: forceArchives });
      setResumeArchives(archives);
      const index = buildCrawlResumeMatchIndex(archives);
      setBadgeByCompany(buildCrawlCompanyBadgeMap(jobs, index));
    } catch {
      // Archives unavailable — treat everything as unmatched (good) for this pass.
      setResumeArchives([]);
      setBadgeByCompany(buildCrawlCompanyBadgeMap(jobs, buildCrawlResumeMatchIndex([])));
    }
  }

  async function openSavedRecordsDialog(companyName: string, companyLabel: string) {
    setSavedRecordsDialog({ companyName, companyLabel });
    setSavedRecordsLoading(true);
    try {
      const archives = await listSavedResumesCached({ force: false });
      setResumeArchives(archives);
    } catch {
      // Keep whatever archives we already have; dialog shows empty/filtered list.
    } finally {
      setSavedRecordsLoading(false);
    }
  }

  function handleJobRowContextMenu(
    event: ReactMouseEvent<HTMLTableRowElement>,
    job: DiscoveredJobRow,
    companyLabel: string
  ) {
    event.preventDefault();
    setRowContextMenu({
      x: event.clientX,
      y: event.clientY,
      companyName: job.companyName,
      companyLabel: companyLabel || normalizeCompanyName(job.companyName) || "—",
    });
  }

  const dialogArchives = useMemo(() => {
    if (!savedRecordsDialog) return [];
    return filterArchivesByCompany(resumeArchives, savedRecordsDialog.companyName);
  }, [resumeArchives, savedRecordsDialog]);

  useEffect(() => {
    const isNewUserSession = hydratedUserIdRef.current !== userId;
    hydratedUserIdRef.current = userId;

    const stored = loadStoredJobCrawl(userId);

    if (isNewUserSession) {
      // Full hydrate only when the signed-in user changes (or first mount).
      setListingUrls(mergeListingUrls(profileListingUrls ?? stored?.listingUrls));
      if (stored) {
        setSelectedPlatforms(stored.selectedPlatforms);
        setJobList(stored.jobs);
        if (stored.savedAt) setLastCrawledAt(stored.savedAt);
        setCrawlDiff(stored.lastDiff ?? null);
        void refreshResumeFitBadges(stored.jobs);
      } else {
        setSelectedPlatforms(defaultSelectedPlatforms());
        setJobList([]);
        setLastCrawledAt(null);
        setBadgeByCompany(new Map());
        setResumeArchives([]);
        setCrawlDiff(null);
        setResultPostedWithin(null);
      }
      setCheckedJobKeys(new Set());
      setCompanyPage(1);
      setRowContextMenu(null);
      setSavedRecordsDialog(null);
      setPlatformErrors({});
      setCrawlProgress({});
      setSheetFeedback(null);
      try {
        const savedCountry = window.localStorage.getItem(SHEET_COUNTRY_STORAGE_KEY);
        if (savedCountry && (JOB_SHEET_COUNTRIES as readonly string[]).includes(savedCountry)) {
          setSheetCountry(savedCountry as JobSheetCountry);
        }
      } catch {
        // ignore
      }
      setHydrated(true);
      return;
    }

    // Same user: refresh crawl URL defaults from profile only — never wipe the job table.
    if (profileListingUrls) {
      const nextUrls = mergeListingUrls(profileListingUrls);
      setListingUrls((current) => {
        const unchanged = ALL_JOB_CRAWL_PLATFORMS.every(
          (platform) => current[platform] === nextUrls[platform]
        );
        return unchanged ? current : nextUrls;
      });
    }
  }, [userId, profileListingUrls]);

  const allPlatformSelected = ALL_JOB_CRAWL_PLATFORMS.every((p) => selectedPlatforms.includes(p));
  const listingReady =
    selectedPlatforms.length > 0 &&
    selectedPlatforms.every((p) => {
      const url = listingUrls[p]?.trim() ?? "";
      return url.length > 0 && PLATFORM_URL_VALID[p](url);
    });
  const canCrawl = !crawling && listingReady;
  const crawlProgressEntries = useMemo(
    () =>
      selectedPlatforms
        .map((platform) => {
          const progress = crawlProgress[platform];
          if (!progress) return null;
          return [platform, progress] as const;
        })
        .filter((entry): entry is readonly [JobCrawlPlatform, PlatformCrawlProgress] => Boolean(entry)),
    [crawlProgress, selectedPlatforms]
  );
  const crawlFinishedCount = useMemo(
    () =>
      crawlProgressEntries.filter(
        ([, progress]) => progress.status === "done" || progress.status === "error"
      ).length,
    [crawlProgressEntries]
  );

  const filteredJobRows = useMemo(
    () => filterJobsByTitle(jobList, jobTitleFilter),
    [jobList, jobTitleFilter]
  );
  const hasTitleFilter = jobTitleFilter.trim().length > 0;

  const companyGroups = useMemo(() => {
    const getBadge = (companyName: string | undefined | null): CrawlJobResumeBadge =>
      badgeByCompany.get(companyBadgeKey(companyName)) ?? "good";
    return buildCompanyGroups(filteredJobRows, getBadge);
  }, [filteredJobRows, badgeByCompany]);

  const totalCompanyPages = Math.max(1, Math.ceil(companyGroups.length / COMPANIES_PER_PAGE));
  const safeCompanyPage = Math.min(companyPage, totalCompanyPages);
  const pageCompanyGroups = useMemo(() => {
    const start = (safeCompanyPage - 1) * COMPANIES_PER_PAGE;
    return companyGroups.slice(start, start + COMPANIES_PER_PAGE);
  }, [companyGroups, safeCompanyPage]);
  const pageJobRows = useMemo(
    () => pageCompanyGroups.flatMap((group) => group.rows),
    [pageCompanyGroups]
  );

  useEffect(() => {
    setCompanyPage(1);
  }, [jobTitleFilter, jobList]);

  useEffect(() => {
    if (companyPage > totalCompanyPages) setCompanyPage(totalCompanyPages);
  }, [companyPage, totalCompanyPages]);

  /** Unique company badge counts for the visible (title-filtered) rows. */
  const visibleBadgeCounts = useMemo(
    () =>
      countCrawlCompanyBadges(
        filteredJobRows.map((row) => row.job),
        badgeByCompany
      ),
    [filteredJobRows, badgeByCompany]
  );

  const allPageJobsChecked = useMemo(() => {
    if (pageJobRows.length === 0) return false;
    return pageJobRows.every(({ job, originalIndex }) =>
      checkedJobKeys.has(jobRowKey(job, originalIndex))
    );
  }, [pageJobRows, checkedJobKeys]);

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

  function toggleAllJobsOnPage() {
    if (allPageJobsChecked) {
      setCheckedJobKeys((current) => {
        const next = new Set(current);
        for (const { job, originalIndex } of pageJobRows) {
          next.delete(jobRowKey(job, originalIndex));
        }
        return next;
      });
      return;
    }
    setCheckedJobKeys((current) => {
      const next = new Set(current);
      for (const { job, originalIndex } of pageJobRows) {
        next.add(jobRowKey(job, originalIndex));
      }
      return next;
    });
  }

  function handleSheetCountryChange(value: JobSheetCountry) {
    setSheetCountry(value);
    setSheetFeedback(null);
    try {
      window.localStorage.setItem(SHEET_COUNTRY_STORAGE_KEY, value);
    } catch {
      // ignore
    }
  }

  async function handleAddToSheet() {
    if (addingToSheet || checkedJobKeys.size === 0) return;

    const selectedJobs = jobList
      .map((job, originalIndex) => ({ job, originalIndex }))
      .filter(({ job, originalIndex }) => checkedJobKeys.has(jobRowKey(job, originalIndex)))
      .map(({ job }) => ({
        platform: job.platform,
        jobUrl: job.jobUrl,
      }))
      .filter((job) => job.jobUrl.trim().length > 0);

    if (selectedJobs.length === 0) {
      setSheetFeedback({ tone: "err", text: "Selected jobs are missing URLs." });
      return;
    }

    setAddingToSheet(true);
    setSheetFeedback(null);

    try {
      const response = await fetch("/api/jobs/crawl/add-to-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: sheetCountry,
          jobs: selectedJobs,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        added?: number;
      };

      if (!response.ok) {
        throw new Error(data.error || "Failed to add jobs to the sheet.");
      }

      setSheetFeedback({
        tone: "ok",
        text: data.message || `Added ${data.added ?? selectedJobs.length} job(s) to ${sheetCountry}.`,
      });
      setCheckedJobKeys(new Set());
    } catch (error) {
      setSheetFeedback({
        tone: "err",
        text: getApiErrorMessage(error, "Failed to add jobs to the sheet."),
      });
    } finally {
      setAddingToSheet(false);
    }
  }

  async function handleCrawl() {
    if (!canCrawl) return;

    const platformsThisRun = [...selectedPlatforms];
    const initialProgress: Partial<Record<JobCrawlPlatform, PlatformCrawlProgress>> = {};
    for (const platform of platformsThisRun) {
      initialProgress[platform] = { status: "pending" };
    }

    setCrawling(true);
    setPlatformErrors({});
    setCrawlProgress(initialProgress);

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), BUILTIN_CRAWL_TIMEOUT_MS);

    const crawlResults: Partial<Record<JobCrawlPlatform, JobCrawlResult>> = {};
    const nextErrors: Partial<Record<JobCrawlPlatform, string>> = {};

    await Promise.all(
      platformsThisRun.map(async (platform) => {
        setCrawlProgress((prev) => ({
          ...prev,
          [platform]: { status: "crawling" },
        }));
        try {
          const result = await crawlPlatform(
            platform,
            listingUrls[platform],
            controller.signal,
            postedWithin
          );
          crawlResults[platform] = result;
          setCrawlProgress((prev) => ({
            ...prev,
            [platform]: {
              status: "done",
              jobCount: result.totalCount ?? result.jobs.length,
            },
          }));
        } catch (err) {
          const message = getApiErrorMessage(err, `${PLATFORM_LABEL[platform]} crawl failed.`);
          nextErrors[platform] = message;
          setCrawlProgress((prev) => ({
            ...prev,
            [platform]: { status: "error", message },
          }));
        }
      })
    );

    setPlatformErrors(nextErrors);

    const hadSuccess = platformsThisRun.some((platform) => crawlResults[platform]);

    if (hadSuccess) {
      const freshJobs = flattenCrawlResults(crawlResults, platformsThisRun);
      const savedAt = new Date().toISOString();
      const previousJobs = jobList;
      const diff = previousJobs.length > 0
        ? diffCrawlJobs(previousJobs, freshJobs)
        : { added: 0, removed: 0, newKeys: new Set<string>() };
      const nextDiff =
        previousJobs.length > 0 ? { added: diff.added, removed: diff.removed } : null;
      const echoedPostedWithin =
        platformsThisRun
          .map((platform) => crawlResults[platform]?.postedWithin)
          .find((value) => value === "24h" || value === "3d") ?? postedWithin;

      setJobList(freshJobs);
      setCheckedJobKeys(new Set());
      setCrawlDiff(nextDiff);
      setResultPostedWithin(normalizePostedWithin(echoedPostedWithin));
      // Always re-apply default keywords so results are filtered immediately (not only after refresh).
      setJobTitleFilter(DEFAULT_JOB_TITLE_FILTER);
      setLastCrawledAt(savedAt);
      await refreshResumeFitBadges(freshJobs, true);
      saveStoredJobCrawl(
        {
          selectedPlatforms: platformsThisRun,
          listingUrls,
          jobs: freshJobs,
          savedAt,
          lastDiff: nextDiff ?? undefined,
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

        <fieldset className="min-w-0" disabled={crawling}>
          <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">Crawl mode</legend>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Crawl mode">
            {JOB_CRAWL_POSTED_WITHIN_OPTIONS.map((option) => {
              const selected = postedWithin === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPostedWithin(option.value)}
                  disabled={crawling}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                    selected
                      ? "border-orange-500 bg-orange-500/15 text-orange-900 dark:text-orange-200"
                      : "border-slate-200 bg-white text-slate-700 hover:border-orange-300 dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:border-orange-400/40"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-start sm:items-center">
            <button
              type="button"
              onClick={() => void handleCrawl()}
              disabled={crawling || !listingReady}
              className={`inline-flex items-center justify-center gap-2 bg-gradient-to-r from-tomato-600 via-orange-500 to-sun-400 hover:from-tomato-500 hover:via-orange-400 hover:to-sun-300 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-orange-500/25 ${
                crawling ? "opacity-100" : "disabled:opacity-50"
              }`}
            >
              {crawling ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Crawling… {crawlFinishedCount}/{selectedPlatforms.length}
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
              <p className="text-sm font-medium text-orange-800 dark:text-orange-300" role="status">
                Crawling {postedWithinLabel(postedWithin)} · this can take 30–90+ seconds per platform
              </p>
            ) : null}
          </div>

          {crawling && crawlProgressEntries.length > 0 ? (
            <div
              className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.06] px-4 py-3 dark:bg-orange-500/[0.08]"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Crawl status</p>
                <p className="text-xs font-semibold tabular-nums text-orange-800 dark:text-orange-300">
                  {crawlFinishedCount} of {crawlProgressEntries.length} platforms done
                </p>
              </div>
              <div
                className="mb-3 h-2 overflow-hidden rounded-full bg-orange-500/15"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={crawlProgressEntries.length}
                aria-valuenow={crawlFinishedCount}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-tomato-600 to-sun-400 transition-[width] duration-300"
                  style={{
                    width: `${Math.round(
                      (crawlFinishedCount / Math.max(crawlProgressEntries.length, 1)) * 100
                    )}%`,
                  }}
                />
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {crawlProgressEntries.map(([platform, progress]) => {
                  const label = PLATFORM_LABEL[platform];
                  if (progress.status === "crawling") {
                    return (
                      <li
                        key={platform}
                        className="flex items-center gap-2 rounded-xl border border-orange-500/20 bg-white/70 px-3 py-2 text-sm dark:bg-warm-950/40"
                      >
                        <svg className="h-3.5 w-3.5 shrink-0 animate-spin text-orange-600" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="font-semibold text-slate-900 dark:text-white">{label}</span>
                        <span className="text-xs text-orange-700 dark:text-orange-300">Crawling…</span>
                      </li>
                    );
                  }
                  if (progress.status === "done") {
                    return (
                      <li
                        key={platform}
                        className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-2 text-sm"
                      >
                        <span className="font-semibold text-slate-900 dark:text-white">{label}</span>
                        <span className="text-xs text-emerald-700 dark:text-emerald-300">
                          Done{typeof progress.jobCount === "number" ? ` · ${progress.jobCount}` : ""}
                        </span>
                      </li>
                    );
                  }
                  if (progress.status === "error") {
                    return (
                      <li
                        key={platform}
                        className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.08] px-3 py-2 text-sm"
                      >
                        <span className="font-semibold text-slate-900 dark:text-white">{label}</span>
                        <span className="text-xs text-rose-700 dark:text-rose-300">Failed</span>
                      </li>
                    );
                  }
                  return (
                    <li
                      key={platform}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm dark:border-white/10 dark:bg-warm-950/40"
                    >
                      <span className="font-semibold text-slate-900 dark:text-white">{label}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Waiting…</span>
                    </li>
                  );
                })}
              </ul>
            </div>
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
        <>
          <FixedSheetControls
            sheetCountry={sheetCountry}
            onCountryChange={handleSheetCountryChange}
            onAddToSheet={() => void handleAddToSheet()}
            addingToSheet={addingToSheet}
            selectedCount={checkedJobKeys.size}
          />

          <div className="mt-8 space-y-3 pr-0 sm:pr-[16.5rem]">
            <div className="flex flex-wrap items-center gap-3 text-base">
              <span className="inline-flex items-center rounded-full bg-orange-500/10 px-3.5 py-1.5 font-semibold text-orange-800 dark:text-orange-300">
                {hasTitleFilter
                  ? `${filteredJobRows.length} of ${jobList.length} job${jobList.length === 1 ? "" : "s"}`
                  : `${jobList.length} job${jobList.length === 1 ? "" : "s"}`}
              </span>
              <span
                className="inline-flex items-center rounded-full bg-slate-500/10 px-3.5 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200"
                title="Unique companies in the filtered results"
              >
                {companyGroups.length} compan{companyGroups.length === 1 ? "y" : "ies"}
              </span>
              {resultPostedWithin ? (
                <span
                  className="inline-flex items-center rounded-full bg-slate-500/10 px-3.5 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200"
                  title={`postedWithin=${resultPostedWithin}`}
                >
                  Mode: {postedWithinLabel(resultPostedWithin)}
                </span>
              ) : null}
              <span
                className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-800 dark:text-emerald-300"
                title="No resume archive for this company"
              >
                {visibleBadgeCounts.good} good
              </span>
              <span
                className="inline-flex items-center rounded-full bg-amber-500/15 px-3 py-1.5 text-sm font-semibold text-amber-800 dark:text-amber-300"
                title="Last resume archive for this company was 10+ days ago"
              >
                {visibleBadgeCounts.possible} possible
              </span>
              <span
                className="inline-flex items-center rounded-full bg-rose-500/15 px-3 py-1.5 text-sm font-semibold text-rose-800 dark:text-rose-300"
                title="Last resume archive for this company was within the last 10 days"
              >
                {visibleBadgeCounts.bad} bad
              </span>
              {crawlDiff ? (
                <span
                  className="inline-flex items-center rounded-full bg-slate-500/10 px-3 py-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300"
                  title="Jobs from the previous crawl that are gone now"
                >
                  −{crawlDiff.removed} gone
                </span>
              ) : null}
              {checkedJobKeys.size > 0 ? (
                <span className="text-slate-500 dark:text-slate-400">
                  {checkedJobKeys.size} selected
                </span>
              ) : null}
            </div>

            <div className="min-w-0">
              <label htmlFor="jobTitleFilter" className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                Job title filter
              </label>
              <input
                id="jobTitleFilter"
                type="text"
                value={jobTitleFilter}
                onChange={(e) => setJobTitleFilter(e.target.value)}
                placeholder={DEFAULT_JOB_TITLE_FILTER}
                className={filterInputClass}
                spellCheck={false}
                autoComplete="off"
              />
              <p className="mt-1.5 text-sm text-slate-400 dark:text-slate-500">
                Use <span className="font-semibold text-slate-500 dark:text-slate-400">OR</span> to match any term, or{" "}
                <span className="font-semibold text-slate-500 dark:text-slate-400">AND</span> to require every term.
                Sorted by company badge (good → possible → bad), then company name. {COMPANIES_PER_PAGE} companies per page.
              </p>
            </div>

            {sheetFeedback ? (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  sheetFeedback.tone === "ok"
                    ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-800 dark:text-emerald-200"
                    : "border-red-500/25 bg-red-500/[0.08] text-red-700 dark:text-red-300"
                }`}
              >
                {sheetFeedback.text}
              </div>
            ) : null}

            <CompanyPagination
              page={safeCompanyPage}
              totalPages={totalCompanyPages}
              totalCompanies={companyGroups.length}
              onPageChange={setCompanyPage}
            />

            <MergedJobTable
              groups={pageCompanyGroups}
              companyNumberStart={(safeCompanyPage - 1) * COMPANIES_PER_PAGE + 1}
              checkedKeys={checkedJobKeys}
              onToggleRow={toggleJobRow}
              onToggleAll={toggleAllJobsOnPage}
              allChecked={allPageJobsChecked}
              onRowContextMenu={handleJobRowContextMenu}
              emptyMessage={
                hasTitleFilter ? "No jobs match this job title filter." : undefined
              }
            />

            {companyGroups.length > COMPANIES_PER_PAGE ? (
              <CompanyPagination
                page={safeCompanyPage}
                totalPages={totalCompanyPages}
                totalCompanies={companyGroups.length}
                onPageChange={setCompanyPage}
              />
            ) : null}
          </div>

          {rowContextMenu ? (
            <JobRowContextMenu
              menu={rowContextMenu}
              onClose={() => setRowContextMenu(null)}
              onSavedRecord={() =>
                void openSavedRecordsDialog(
                  rowContextMenu.companyName,
                  rowContextMenu.companyLabel
                )
              }
            />
          ) : null}

          <CompanySavedArchivesDialog
            open={Boolean(savedRecordsDialog)}
            companyLabel={savedRecordsDialog?.companyLabel ?? ""}
            archives={dialogArchives}
            loading={savedRecordsLoading}
            onClose={() => setSavedRecordsDialog(null)}
          />
        </>
      ) : null}
    </div>
  );
}
