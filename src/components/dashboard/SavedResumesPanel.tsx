"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import {
  downloadBlob,
  fetchSavedResumeFile,
  listSavedResumes,
  resolveArchiveFileName,
} from "@/lib/saved-resumes-api";
import type { SavedResumeArchive } from "@/lib/saved-resumes-types";

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
      "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40",
    pickerSection: "mt-5 space-y-4",
    pickerLabel: "text-xs font-semibold uppercase tracking-wider text-slate-500",
    chipGrid: "mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6",
    monthGrid: "mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6",
    chip:
      "rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-sm font-medium text-slate-300 transition-all hover:border-blue-500/30 hover:bg-blue-500/[0.06] disabled:cursor-not-allowed disabled:opacity-35",
    chipSelected: "border-blue-500/50 bg-blue-500/20 text-white shadow-sm shadow-blue-500/20",
    chipCount: "mt-0.5 block text-[10px] font-normal text-slate-500",
    daysSection: "mt-6 space-y-2",
    daysHeading: "text-xs font-semibold uppercase tracking-wider text-slate-500",
    dayButton:
      "flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition-all hover:border-blue-500/30 hover:bg-blue-500/[0.06]",
    dayButtonOpen: "border-blue-500/35 bg-blue-500/[0.08]",
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
      "text-left text-xs text-blue-400 underline-offset-2 hover:text-blue-300 hover:underline line-clamp-2",
    fileLink:
      "font-mono text-xs text-blue-400 underline-offset-2 hover:text-blue-300 hover:underline",
    tbody: "divide-y divide-white/5",
    empty: "rounded-xl border border-white/10 px-4 py-10 text-center text-slate-400",
    error: "mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300",
  },
  resume: {
    section:
      "overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-xl shadow-slate-200/50 backdrop-blur-sm dark:border-white/[0.08] dark:bg-navy-900/80 dark:shadow-black/30 sm:p-8",
    title: "text-lg font-semibold text-slate-900 dark:text-white",
    subtitle: "mt-1 text-sm text-slate-500 dark:text-slate-400",
    input:
      "w-full rounded-xl border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-white/[0.03] px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40",
    pickerSection: "mt-5 space-y-4",
    pickerLabel: "text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400",
    chipGrid: "mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6",
    monthGrid: "mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6",
    chip:
      "rounded-lg border border-slate-200/80 bg-slate-50/80 px-2 py-2 text-sm font-medium text-slate-700 transition-all hover:border-blue-500/35 hover:bg-blue-50/80 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-slate-200 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/[0.06] disabled:cursor-not-allowed disabled:opacity-35",
    chipSelected:
      "border-blue-500/50 bg-blue-500/15 text-blue-700 shadow-sm shadow-blue-500/15 dark:bg-blue-500/20 dark:text-white",
    chipCount: "mt-0.5 block text-[10px] font-normal text-slate-500 dark:text-slate-400",
    daysSection: "mt-6 space-y-2",
    daysHeading: "text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400",
    dayButton:
      "flex w-full items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-left transition-all hover:border-blue-500/35 hover:bg-blue-50/80 dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-blue-500/30 dark:hover:bg-blue-500/[0.06]",
    dayButtonOpen:
      "border-blue-500/40 bg-blue-50/90 dark:border-blue-500/35 dark:bg-blue-500/[0.08]",
    dayLabel: "text-sm font-semibold text-slate-900 dark:text-white",
    dayMeta: "ml-auto text-xs text-slate-500 dark:text-slate-400",
    chevron: "h-4 w-4 shrink-0 text-slate-500 transition-transform dark:text-slate-400",
    groupPanel:
      "overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/[0.08] animate-fade-up",
    tableWrap: "overflow-x-auto",
    thead:
      "border-b border-slate-200/80 bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-slate-400",
    rowHover: "align-top hover:bg-slate-50/80 dark:hover:bg-white/[0.02]",
    bidTime: "whitespace-nowrap px-4 py-3 text-slate-600 tabular-nums dark:text-slate-300",
    company: "px-4 py-3 font-medium text-slate-900 dark:text-white",
    jobTitle: "px-4 py-3 text-slate-700 dark:text-slate-200",
    description: "max-w-xs px-4 py-3 text-slate-500 md:max-w-md dark:text-slate-400",
    descLink:
      "text-left text-xs text-blue-600 underline-offset-2 hover:text-blue-500 hover:underline line-clamp-2 dark:text-blue-400 dark:hover:text-blue-300",
    fileLink:
      "font-mono text-xs text-blue-600 underline-offset-2 hover:text-blue-500 hover:underline dark:text-blue-400 dark:hover:text-blue-300",
    tbody: "divide-y divide-slate-200/80 dark:divide-white/5",
    empty:
      "rounded-xl border border-slate-200/80 px-4 py-10 text-center text-slate-500 dark:border-white/[0.08] dark:text-slate-400",
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

function matchesSearch(item: SavedResumeArchive, query: string): boolean {
  if (!query) return true;
  const parts = parseBidAt(item.bidAt);
  const haystack = [
    item.jobTitle,
    item.companyName,
    item.jobDescription,
    item.resumeFileName,
    parts?.yearLabel ?? "",
    parts?.monthLabel ?? "",
    parts?.dayLabel ?? "",
    parts?.timeLabel ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
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
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Job description
        </p>
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
              <th className="px-4 py-3 font-medium">Resume</th>
              <th className="px-4 py-3 font-medium text-right">Download</th>
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {items.map((item) => {
              const docxKey = `${item.id}:docx`;
              const pdfKey = `${item.id}:pdf`;
              const timeLabel = parseBidAt(item.bidAt)?.timeLabel ?? "—";
              const hasDescription = Boolean(item.jobDescription?.trim());

              return (
                <tr key={item.id} className={styles.rowHover}>
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
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onPreview(item)}
                      className={styles.fileLink}
                    >
                      {item.resumeFileName}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
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
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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

  const loadItems = useCallback(async (query: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await listSavedResumes(query);
      setItems(sortByBidDate(data));
    } catch (err) {
      setItems([]);
      setError((err as Error).message || "Could not load saved resumes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    void loadItems(debouncedSearch);
  }, [debouncedSearch, loadItems]);

  const visibleItems = useMemo(() => {
    const query = debouncedSearch.trim();
    if (!query) return items;
    return items.filter((item) => matchesSearch(item, query));
  }, [items, debouncedSearch]);

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
    if (!debouncedSearch.trim() || !selectedMonth) return;
    setExpandedDayKeys(new Set(selectedMonth.days.map((day) => day.dayKey)));
  }, [debouncedSearch, selectedMonth]);

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className={styles.title}>Saved resumes</h2>
          <p className={styles.subtitle}>
            Pick a year and month, then expand a date to see applications. Click a job description
            preview for the full posting.
          </p>
        </div>
        <div className="w-full sm:max-w-xs">
          <label htmlFor="saved-resume-search" className="sr-only">
            Search saved resumes
          </label>
          <input
            id="saved-resume-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search applications…"
            className={styles.input}
          />
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
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            Loading saved resumes…
          </span>
        </div>
      ) : yearGroups.length === 0 ? (
        <div className={`${styles.empty} mt-5`}>
          {debouncedSearch
            ? "No applications match your search."
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
