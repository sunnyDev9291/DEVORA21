"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import {
  downloadBlob,
  fetchSavedResumeFile,
  listSavedResumes,
  resolveArchiveFileName,
  type SavedResumeSearchFilters,
} from "@/lib/saved-resumes-api";
import type { SavedResumeArchive } from "@/lib/saved-resumes-types";
import { TODAYS_RESUME_COUNT_CHANGED_EVENT } from "@/lib/todays-resume-count";
import { brand, ui } from "@/lib/ui-styles";
import CopyIconButton from "@/components/ui/CopyIconButton";

const PdfPreviewModal = dynamic(() => import("@/components/ui/PdfPreviewModal"), { ssr: false });
const Modal = dynamic(() => import("@/components/ui/Modal"), { ssr: false });

type SavedResumesPanelProps = {
  variant?: "dashboard" | "resume";
};

type BidDateParts = {
  yearKey: string;
  monthKey: string;
  dayKey: string;
  yearLabel: string;
  monthLabel: string;
  monthIndex: number;
  dayLabel: string;
  dayNumber: number;
  timeLabel: string;
  dateLabel: string;
};

type DayGroup = {
  dayKey: string;
  dayLabel: string;
  dayNumber: number;
  items: SavedResumeArchive[];
};

type MonthGroup = {
  monthKey: string;
  monthLabel: string;
  monthIndex: number;
  days: DayGroup[];
  totalCount: number;
};

type YearGroup = {
  yearKey: string;
  yearLabel: string;
  months: MonthGroup[];
  totalCount: number;
};

type PanelStyles = (typeof STYLES)["dashboard"] | (typeof STYLES)["resume"];

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const STYLES = {
  dashboard: {
    section: "rounded-2xl border border-white/10 bg-navy-900/60 p-6",
    title: "text-lg font-semibold text-white",
    subtitle: "mt-1 text-sm text-slate-400",
    input:
      "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40",
    searchPanel: "mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5",
    searchGrid: "grid gap-4 sm:grid-cols-2",
    searchField: "space-y-1.5",
    searchLabel: "text-xs font-semibold uppercase tracking-wider text-slate-500",
    searchActions: "mt-4 flex flex-wrap items-center gap-3",
    searchHint: "text-xs text-slate-500",
    pickerSection: "mt-5 space-y-4",
    pickerLabel: "text-xs font-semibold uppercase tracking-wider text-slate-500",
    chipGrid: "mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6",
    monthGrid: "mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6",
    chip:
      "rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-sm font-medium text-slate-300 transition-all hover:border-orange-500/30 hover:bg-blue-500/[0.06] disabled:cursor-not-allowed disabled:opacity-35",
    chipSelected: "border-orange-500/50 bg-blue-500/20 text-white shadow-sm shadow-blue-500/20",
    chipCount: "mt-0.5 block text-[12px] font-normal text-slate-500",
    daysSection: "mt-6 space-y-2",
    daysHeading: "text-xs font-semibold uppercase tracking-wider text-slate-500",
    dayButton:
      "flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition-all hover:border-orange-500/30 hover:bg-blue-500/[0.06]",
    dayButtonOpen: "border-orange-500/35 bg-blue-500/[0.08]",
    dayLabel: "text-sm font-semibold text-white",
    dayMeta: "ml-auto text-xs text-slate-400",
    chevron: "h-4 w-4 shrink-0 text-slate-400 transition-transform",
    groupPanel: "overflow-hidden rounded-xl border border-white/10 animate-fade-up",
    tableWrap: "overflow-x-auto",
    thead: "border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wider text-slate-500",
    rowHover: "align-top hover:bg-white/[0.02]",
    bidTime: "whitespace-nowrap px-4 py-3 text-slate-300 tabular-nums",
    company: "px-4 py-3 font-medium text-white",
    jobTitle: "px-4 py-3 text-slate-200",
    description: "max-w-xs px-4 py-3 text-slate-400 md:max-w-md",
    descLink:
      "text-left text-xs text-orange-400 underline-offset-2 hover:text-orange-300 hover:underline line-clamp-2",
    fileName:
      "block text-left font-mono text-xs leading-relaxed whitespace-normal break-all text-orange-400 underline-offset-2 hover:text-orange-300 hover:underline",
    fileNameCell: "min-w-[14rem] px-4 py-3 align-top whitespace-normal",
    actionsCell:
      "sticky right-0 z-[1] whitespace-nowrap bg-navy-900/95 px-4 py-3 shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.45)] group-hover:bg-white/[0.04]",
    actionsHead:
      "sticky right-0 z-[1] bg-white/[0.02] px-4 py-3 text-right font-medium shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.45)]",
    actionGroup: "inline-flex flex-row flex-nowrap items-center gap-2",
    tbody: "divide-y divide-white/5",
    empty: "rounded-xl border border-white/10 px-4 py-10 text-center text-slate-400",
    error: "mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300",
  },
  resume: {
    section:
      "overflow-hidden rounded-[1.75rem] border border-orange-200/55 bg-gloss-warm p-6 shadow-elevated backdrop-blur-md dark:border-orange-500/15 dark:bg-gloss-warm-dark dark:shadow-card-dark sm:p-8",
    title: `font-display text-2xl font-bold tracking-tight ${brand.gradientText}`,
    subtitle: "mt-2 max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-stone-300",
    input: ui.input.replace("text-[17px] leading-snug", "text-sm leading-snug").replace("py-3", "py-2.5"),
    searchPanel:
      "mt-6 rounded-2xl border border-orange-200/50 bg-gradient-to-br from-white/70 via-orange-50/40 to-amber-50/30 p-4 shadow-sm backdrop-blur-sm dark:border-orange-500/15 dark:from-warm-950/50 dark:via-warm-900/40 dark:to-orange-950/20 sm:p-5",
    searchGrid: "grid gap-4 sm:grid-cols-2",
    searchField: "space-y-1.5",
    searchLabel: "text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-800/70 dark:text-orange-300/80",
    searchActions: "mt-4 flex flex-wrap items-center gap-3",
    searchHint: "text-xs text-stone-500 dark:text-stone-400",
    pickerSection: "mt-6 space-y-5",
    pickerLabel: "text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-800/70 dark:text-orange-300/80",
    chipGrid: "mt-2.5 grid grid-cols-4 gap-2 sm:grid-cols-6",
    monthGrid: "mt-2.5 grid grid-cols-4 gap-2 sm:grid-cols-6",
    chip:
      "group rounded-xl border border-orange-200/60 bg-white/70 px-2 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition-all hover:border-orange-400/50 hover:bg-orange-50 hover:-translate-y-px dark:border-orange-500/15 dark:bg-warm-950/45 dark:text-stone-200 dark:hover:border-orange-400/35 dark:hover:bg-orange-500/10 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0",
    chipSelected:
      "border-transparent bg-gradient-to-r from-tomato-600 via-orange-500 to-sun-400 text-white shadow-md shadow-orange-500/25 hover:bg-none hover:from-tomato-600 hover:via-orange-500 hover:to-sun-400 dark:text-white",
    chipCount:
      "mt-0.5 block text-[11px] font-medium text-stone-500 group-aria-selected:text-white/85 dark:text-stone-400",
    daysSection: "mt-6 space-y-2.5",
    daysHeading: "text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-800/70 dark:text-orange-300/80",
    dayButton:
      "flex w-full items-center gap-3 rounded-xl border border-orange-200/55 bg-white/65 px-4 py-3.5 text-left shadow-sm transition-all hover:border-orange-400/45 hover:bg-orange-50/80 dark:border-orange-500/15 dark:bg-warm-950/40 dark:hover:border-orange-400/30 dark:hover:bg-orange-500/[0.08]",
    dayButtonOpen:
      "border-orange-400/50 bg-orange-50/90 shadow-md shadow-orange-500/10 dark:border-orange-400/35 dark:bg-orange-500/[0.12]",
    dayLabel: "text-sm font-semibold text-stone-900 dark:text-white",
    dayMeta: "ml-auto text-xs font-medium text-orange-700/80 dark:text-orange-300/80",
    chevron: "h-4 w-4 shrink-0 text-orange-500/70 transition-transform dark:text-orange-300/70",
    groupPanel:
      "overflow-hidden rounded-2xl border border-orange-200/55 bg-white/55 shadow-sm backdrop-blur-sm dark:border-orange-500/15 dark:bg-warm-950/45 animate-fade-up",
    tableWrap: "overflow-x-auto",
    thead:
      "border-b border-orange-200/50 bg-orange-50/70 text-[11px] uppercase tracking-[0.12em] text-orange-800/70 dark:border-orange-500/12 dark:bg-orange-500/[0.08] dark:text-orange-200/70",
    rowHover: "align-top hover:bg-orange-50/50 dark:hover:bg-orange-500/[0.06]",
    bidTime: "whitespace-nowrap px-4 py-3 text-stone-600 tabular-nums dark:text-stone-300",
    company: "px-4 py-3 font-semibold text-stone-900 dark:text-white",
    jobTitle: "px-4 py-3 text-stone-700 dark:text-stone-200",
    description: "max-w-xs px-4 py-3 text-stone-500 md:max-w-md dark:text-stone-400",
    descLink:
      "text-left text-xs text-orange-700 underline-offset-2 hover:text-tomato-600 hover:underline line-clamp-2 dark:text-orange-300 dark:hover:text-orange-200",
    fileName:
      "block text-left font-mono text-xs leading-relaxed whitespace-normal break-all text-orange-700 underline-offset-2 hover:text-tomato-600 hover:underline dark:text-orange-300 dark:hover:text-orange-200",
    fileNameCell: "min-w-[14rem] px-4 py-3 align-top whitespace-normal",
    actionsCell:
      "sticky right-0 z-[1] whitespace-nowrap bg-white/90 px-4 py-3 shadow-[-8px_0_12px_-8px_rgba(194,65,12,0.12)] backdrop-blur-sm group-hover:bg-orange-50/95 dark:bg-warm-950/95 dark:shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.45)] dark:group-hover:bg-orange-500/[0.08]",
    actionsHead:
      "sticky right-0 z-[1] bg-orange-50/95 px-4 py-3 text-right font-medium shadow-[-8px_0_12px_-8px_rgba(194,65,12,0.12)] dark:bg-orange-500/[0.08] dark:shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.45)]",
    actionGroup: "inline-flex flex-row flex-nowrap items-center gap-2",
    tbody: "divide-y divide-orange-100/80 dark:divide-orange-500/10",
    empty:
      "rounded-2xl border border-dashed border-orange-200/70 bg-orange-50/40 px-4 py-12 text-center text-stone-600 dark:border-orange-500/20 dark:bg-orange-500/[0.06] dark:text-stone-300",
    error:
      "mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300",
  },
} as const;

function parseBidAt(iso: string): BidDateParts | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return {
    yearKey: String(year),
    monthKey: `${year}-${month}`,
    dayKey: `${year}-${month}-${day}`,
    yearLabel: String(year),
    monthLabel: new Intl.DateTimeFormat(undefined, { month: "long" }).format(date),
    monthIndex: date.getMonth(),
    dayLabel: new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(date),
    dayNumber: date.getDate(),
    timeLabel: new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date),
    dateLabel: new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date),
  };
}

function formatBidAt(iso: string): string {
  return parseBidAt(iso)?.dateLabel ?? iso;
}

function truncate(text: string, max = 100): string {
  const trimmed = text.trim();
  if (!trimmed) return "No description";
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

function hasActiveFilters(filters: SavedResumeSearchFilters): boolean {
  return Boolean(
    filters.company?.trim() ||
      filters.jobTitle?.trim() ||
      filters.jd?.trim() ||
      filters.dateFrom?.trim() ||
      filters.dateTo?.trim()
  );
}

function sortByBidDate(items: SavedResumeArchive[]): SavedResumeArchive[] {
  return [...items].sort((a, b) => new Date(b.bidAt).getTime() - new Date(a.bidAt).getTime());
}

function groupByYearMonthDay(items: SavedResumeArchive[]): YearGroup[] {
  const years = new Map<string, YearGroup>();

  for (const item of sortByBidDate(items)) {
    const parts = parseBidAt(item.bidAt);
    if (!parts) continue;

    let year = years.get(parts.yearKey);
    if (!year) {
      year = {
        yearKey: parts.yearKey,
        yearLabel: parts.yearLabel,
        months: [],
        totalCount: 0,
      };
      years.set(parts.yearKey, year);
    }

    let month = year.months.find((m) => m.monthKey === parts.monthKey);
    if (!month) {
      month = {
        monthKey: parts.monthKey,
        monthLabel: parts.monthLabel,
        monthIndex: parts.monthIndex,
        days: [],
        totalCount: 0,
      };
      year.months.push(month);
    }

    let day = month.days.find((d) => d.dayKey === parts.dayKey);
    if (!day) {
      day = {
        dayKey: parts.dayKey,
        dayLabel: parts.dayLabel,
        dayNumber: parts.dayNumber,
        items: [],
      };
      month.days.push(day);
    }

    day.items.push(item);
    month.totalCount += 1;
    year.totalCount += 1;
  }

  return [...years.values()]
    .sort((a, b) => b.yearKey.localeCompare(a.yearKey))
    .map((year) => ({
      ...year,
      months: [...year.months]
        .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
        .map((month) => ({
          ...month,
          days: [...month.days].sort((a, b) => b.dayKey.localeCompare(a.dayKey)),
        })),
    }));
}

function countLabel(count: number): string {
  return count === 1 ? "1 application" : `${count} applications`;
}

function Chevron({ open, className }: { open: boolean; className: string }) {
  return (
    <svg
      className={`${className} ${open ? "rotate-90" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function JobDescriptionModal({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item: SavedResumeArchive | null;
}) {
  const description = item?.jobDescription?.trim() || "No job description was saved for this application.";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? `${item.jobTitle} at ${item.companyName}` : "Job description"}
      className="max-w-2xl"
    >
      <div className="overflow-y-auto px-6 py-5 max-h-[min(70dvh,32rem)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Job description
          </p>
          <CopyIconButton
            text={item?.jobDescription ?? ""}
            label="Copy job description"
            className="h-10 self-auto"
          />
        </div>
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          {description}
        </div>
      </div>
    </Modal>
  );
}

function ApplicationRows({
  items,
  styles,
  downloadingKey,
  onPreview,
  onDownload,
  onJobDescription,
}: {
  items: SavedResumeArchive[];
  styles: PanelStyles;
  downloadingKey: string | null;
  onPreview: (item: SavedResumeArchive) => void;
  onDownload: (item: SavedResumeArchive, format: "docx" | "pdf") => void;
  onJobDescription: (item: SavedResumeArchive) => void;
}) {
  return (
    <div className={styles.groupPanel}>
      <div className={styles.tableWrap}>
        <table className="min-w-full text-left text-sm">
          <thead className={styles.thead}>
            <tr>
              <th className="px-4 py-3 font-medium">Bid time</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Job title</th>
              <th className="px-4 py-3 font-medium">Job description</th>
              <th className="px-4 py-3 font-medium">File name</th>
              <th className={styles.actionsHead}>Download</th>
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {items.map((item) => {
              const docxKey = `${item.id}:docx`;
              const pdfKey = `${item.id}:pdf`;
              const timeLabel = parseBidAt(item.bidAt)?.timeLabel ?? "—";
              const hasDescription = Boolean(item.jobDescription?.trim());

              return (
                <tr key={item.id} className={`group ${styles.rowHover}`}>
                  <td className={styles.bidTime}>{timeLabel}</td>
                  <td className={styles.company}>{item.companyName}</td>
                  <td className={styles.jobTitle}>{item.jobTitle}</td>
                  <td className={styles.description}>
                    <button
                      type="button"
                      onClick={() => onJobDescription(item)}
                      className={styles.descLink}
                      title={hasDescription ? "View full job description" : undefined}
                    >
                      {hasDescription ? truncate(item.jobDescription) : "No description"}
                    </button>
                  </td>
                  <td className={styles.fileNameCell}>
                    <button
                      type="button"
                      onClick={() => onPreview(item)}
                      className={styles.fileName}
                    >
                      {item.resumeFileName}
                    </button>
                  </td>
                  <td className={styles.actionsCell}>
                    <div className={styles.actionGroup}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={downloadingKey === docxKey}
                        onClick={() => onDownload(item, "docx")}
                      >
                        {downloadingKey === docxKey ? "…" : "DOCX"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={downloadingKey === pdfKey}
                        onClick={() => onDownload(item, "pdf")}
                      >
                        {downloadingKey === pdfKey ? "…" : "PDF"}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SavedResumesPanel({ variant = "dashboard" }: SavedResumesPanelProps) {
  const styles = STYLES[variant];
  const [items, setItems] = useState<SavedResumeArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [jobTitleSearch, setJobTitleSearch] = useState("");
  const [jdSearch, setJdSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [debouncedCompany, setDebouncedCompany] = useState("");
  const [debouncedJobTitle, setDebouncedJobTitle] = useState("");
  const [debouncedJd, setDebouncedJd] = useState("");
  const [selectedYearKey, setSelectedYearKey] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [expandedDayKeys, setExpandedDayKeys] = useState<Set<string>>(new Set());

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<SavedResumeArchive | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [jobDescOpen, setJobDescOpen] = useState(false);
  const [jobDescItem, setJobDescItem] = useState<SavedResumeArchive | null>(null);

  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  const activeFilters = useMemo<SavedResumeSearchFilters>(
    () => ({
      company: debouncedCompany.trim(),
      jobTitle: debouncedJobTitle.trim(),
      jd: debouncedJd.trim(),
      dateFrom: dateFrom.trim(),
      dateTo: dateTo.trim(),
    }),
    [debouncedCompany, debouncedJobTitle, debouncedJd, dateFrom, dateTo]
  );

  const filtersActive = hasActiveFilters(activeFilters);

  const loadItems = useCallback(async (filters: SavedResumeSearchFilters) => {
    setLoading(true);
    setError("");
    try {
      const data = await listSavedResumes(filters);
      setItems(sortByBidDate(data));
    } catch (err) {
      setItems([]);
      setError((err as Error).message || "Could not load saved resumes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedCompany(companySearch);
      setDebouncedJobTitle(jobTitleSearch);
      setDebouncedJd(jdSearch);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [companySearch, jobTitleSearch, jdSearch]);

  useEffect(() => {
    void loadItems(activeFilters);
  }, [activeFilters, loadItems]);

  useEffect(() => {
    function onArchiveChanged() {
      void loadItems(activeFilters);
    }
    window.addEventListener(TODAYS_RESUME_COUNT_CHANGED_EVENT, onArchiveChanged);
    return () => window.removeEventListener(TODAYS_RESUME_COUNT_CHANGED_EVENT, onArchiveChanged);
  }, [activeFilters, loadItems]);

  const visibleItems = items;

  const yearGroups = useMemo(() => groupByYearMonthDay(visibleItems), [visibleItems]);

  const selectedYear = useMemo(
    () => yearGroups.find((year) => year.yearKey === selectedYearKey) ?? null,
    [yearGroups, selectedYearKey]
  );

  const selectedMonth = useMemo(
    () => selectedYear?.months.find((month) => month.monthKey === selectedMonthKey) ?? null,
    [selectedYear, selectedMonthKey]
  );

  useEffect(() => {
    if (yearGroups.length === 0) {
      setSelectedYearKey(null);
      setSelectedMonthKey(null);
      setExpandedDayKeys(new Set());
      return;
    }

    const nextYear = yearGroups.some((y) => y.yearKey === selectedYearKey)
      ? selectedYearKey!
      : yearGroups[0].yearKey;

    const year = yearGroups.find((y) => y.yearKey === nextYear)!;
    const nextMonth = year.months.some((m) => m.monthKey === selectedMonthKey)
      ? selectedMonthKey!
      : (year.months[0]?.monthKey ?? null);

    if (nextYear !== selectedYearKey) setSelectedYearKey(nextYear);
    if (nextMonth !== selectedMonthKey) setSelectedMonthKey(nextMonth);
  }, [yearGroups, selectedYearKey, selectedMonthKey]);

  useEffect(() => {
    if (!filtersActive || !selectedMonth) return;
    setExpandedDayKeys(new Set(selectedMonth.days.map((day) => day.dayKey)));
  }, [filtersActive, selectedMonth]);

  function clearFilters() {
    setCompanySearch("");
    setJobTitleSearch("");
    setJdSearch("");
    setDateFrom("");
    setDateTo("");
    setDebouncedCompany("");
    setDebouncedJobTitle("");
    setDebouncedJd("");
    setExpandedDayKeys(new Set());
  }

  function selectYear(yearKey: string) {
    setSelectedYearKey(yearKey);
    const year = yearGroups.find((y) => y.yearKey === yearKey);
    setSelectedMonthKey(year?.months[0]?.monthKey ?? null);
    setExpandedDayKeys(new Set());
  }

  function selectMonth(monthKey: string) {
    setSelectedMonthKey(monthKey);
    setExpandedDayKeys(new Set());
  }

  function toggleDay(dayKey: string) {
    setExpandedDayKeys((current) => {
      const next = new Set(current);
      if (next.has(dayKey)) next.delete(dayKey);
      else next.add(dayKey);
      return next;
    });
  }

  function openJobDescription(item: SavedResumeArchive) {
    setJobDescItem(item);
    setJobDescOpen(true);
  }

  async function openPreview(item: SavedResumeArchive) {
    setPreviewItem(item);
    setPreviewOpen(true);
    setPreviewBlob(null);
    setPreviewError("");
    setPreviewLoading(true);

    try {
      const { blob } = await fetchSavedResumeFile(
        item.id,
        "pdf",
        resolveArchiveFileName(item, "pdf")
      );
      setPreviewBlob(blob);
    } catch (err) {
      setPreviewError((err as Error).message || "Could not load PDF preview.");
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    setPreviewOpen(false);
    setPreviewItem(null);
    setPreviewBlob(null);
    setPreviewError("");
    setPreviewLoading(false);
  }

  async function handleDownload(item: SavedResumeArchive, format: "docx" | "pdf") {
    const key = `${item.id}:${format}`;
    setDownloadingKey(key);
    try {
      const { blob, fileName } = await fetchSavedResumeFile(
        item.id,
        format,
        resolveArchiveFileName(item, format)
      );
      downloadBlob(blob, fileName);
    } catch (err) {
      setError((err as Error).message || "Download failed.");
    } finally {
      setDownloadingKey(null);
    }
  }

  const monthSlots = useMemo(() => {
    const byIndex = new Map<number, MonthGroup>();
    for (const month of selectedYear?.months ?? []) {
      byIndex.set(month.monthIndex, month);
    }
    return MONTH_SHORT.map((label, index) => ({
      label,
      index,
      month: byIndex.get(index) ?? null,
    }));
  }, [selectedYear]);

  return (
    <section className={styles.section}>
      <div className="relative">
        <div
          className="pointer-events-none absolute -left-2 -top-2 h-16 w-16 rounded-full bg-orange-400/20 blur-2xl dark:bg-orange-500/15"
          aria-hidden="true"
        />
        <p className="relative text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-700/80 dark:text-orange-300/80">
          Application archive
        </p>
        <h2 className={`relative mt-1.5 ${styles.title}`}>Saved resumes</h2>
        <p className={`relative ${styles.subtitle}`}>
          Filter by date range, company, job title, or job description, then pick a year and month to browse
          applications.
        </p>
      </div>

      <div className={styles.searchPanel}>
        <div className={styles.searchGrid}>
          <div className={styles.searchField}>
            <label htmlFor="saved-resume-date-from" className={styles.searchLabel}>
              From date
            </label>
            <input
              id="saved-resume-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={styles.input}
            />
          </div>
          <div className={styles.searchField}>
            <label htmlFor="saved-resume-date-to" className={styles.searchLabel}>
              To date
            </label>
            <input
              id="saved-resume-date-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className={styles.input}
            />
          </div>
          <div className={styles.searchField}>
            <label htmlFor="saved-resume-company" className={styles.searchLabel}>
              Company name
            </label>
            <input
              id="saved-resume-company"
              type="search"
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              placeholder="Search by company…"
              className={styles.input}
            />
          </div>
          <div className={styles.searchField}>
            <label htmlFor="saved-resume-job-title" className={styles.searchLabel}>
              Job title
            </label>
            <input
              id="saved-resume-job-title"
              type="search"
              value={jobTitleSearch}
              onChange={(e) => setJobTitleSearch(e.target.value)}
              placeholder="Search by job title…"
              className={styles.input}
            />
          </div>
          <div className={`${styles.searchField} sm:col-span-2`}>
            <label htmlFor="saved-resume-jd" className={styles.searchLabel}>
              Job description
            </label>
            <input
              id="saved-resume-jd"
              type="search"
              value={jdSearch}
              onChange={(e) => setJdSearch(e.target.value)}
              placeholder="Search inside JD text…"
              className={styles.input}
            />
          </div>
        </div>
        <div className={styles.searchActions}>
          {filtersActive ? (
            <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
          <p className={styles.searchHint}>Filters combine together. Leave fields empty to ignore them.</p>
        </div>
      </div>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className={`${styles.empty} mt-5`}>
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
            Loading saved resumes…
          </span>
        </div>
      ) : yearGroups.length === 0 ? (
        <div className={`${styles.empty} mt-5`}>
          {filtersActive
            ? "No applications match your filters."
            : "No saved resumes yet. Apply a tailored resume from New resume to save one here."}
        </div>
      ) : (
        <div className={styles.pickerSection}>
          <div>
            <p className={styles.pickerLabel}>Year</p>
            <div className={styles.chipGrid} role="listbox" aria-label="Select year">
              {yearGroups.map((year) => {
                const selected = year.yearKey === selectedYearKey;
                return (
                  <button
                    key={year.yearKey}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => selectYear(year.yearKey)}
                    className={`${styles.chip} ${selected ? styles.chipSelected : ""}`}
                  >
                    {year.yearLabel}
                    <span className={styles.chipCount}>{year.totalCount}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedYear && (
            <div>
              <p className={styles.pickerLabel}>Month</p>
              <div className={styles.monthGrid} role="listbox" aria-label="Select month">
                {monthSlots.map(({ label, month }) => {
                  const selected = month?.monthKey === selectedMonthKey;
                  const disabled = !month;
                  return (
                    <button
                      key={label}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={disabled}
                      onClick={() => month && selectMonth(month.monthKey)}
                      className={`${styles.chip} ${selected ? styles.chipSelected : ""}`}
                    >
                      {label}
                      {month ? (
                        <span className={styles.chipCount}>{month.totalCount}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedMonth && selectedMonth.days.length > 0 && (
            <div className={styles.daysSection}>
              <p className={styles.daysHeading}>
                {selectedMonth.monthLabel} {selectedYear?.yearLabel} — select a date
              </p>
              <div className="space-y-2">
                {selectedMonth.days.map((day) => {
                  const dayOpen = expandedDayKeys.has(day.dayKey);
                  return (
                    <div key={day.dayKey}>
                      <button
                        type="button"
                        onClick={() => toggleDay(day.dayKey)}
                        aria-expanded={dayOpen}
                        className={`${styles.dayButton} ${dayOpen ? styles.dayButtonOpen : ""}`}
                      >
                        <Chevron open={dayOpen} className={styles.chevron} />
                        <span className={styles.dayLabel}>{day.dayLabel}</span>
                        <span className={styles.dayMeta}>{countLabel(day.items.length)}</span>
                      </button>

                      {dayOpen && (
                        <div className="mt-2">
                          <ApplicationRows
                            items={day.items}
                            styles={styles}
                            downloadingKey={downloadingKey}
                            onPreview={(item) => void openPreview(item)}
                            onDownload={(item, format) => void handleDownload(item, format)}
                            onJobDescription={openJobDescription}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedMonth && selectedMonth.days.length === 0 && (
            <div className={styles.empty}>No applications in this month.</div>
          )}
        </div>
      )}

      <JobDescriptionModal
        open={jobDescOpen}
        onClose={() => {
          setJobDescOpen(false);
          setJobDescItem(null);
        }}
        item={jobDescItem}
      />

      <PdfPreviewModal
        open={previewOpen}
        onClose={closePreview}
        title={previewItem?.resumeFileName ?? "Resume preview"}
        subtitle={
          previewItem
            ? `${previewItem.jobTitle} at ${previewItem.companyName} · ${formatBidAt(previewItem.bidAt)}`
            : undefined
        }
        fileName={previewItem?.pdfFileName ?? previewItem?.resumeFileName?.replace(/\.docx$/i, ".pdf")}
        blob={previewBlob}
        waitingForPdf={previewLoading}
        error={previewError}
        onDownload={previewItem ? () => void handleDownload(previewItem, "pdf") : undefined}
      />
    </section>
  );
}
