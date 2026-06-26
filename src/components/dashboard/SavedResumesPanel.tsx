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

type SavedResumesPanelProps = {
  variant?: "dashboard" | "resume";
};

type BidDateParts = {
  dateKey: string;
  dateLabel: string;
  timeLabel: string;
};

type DateGroup = {
  dateKey: string;
  dateLabel: string;
  items: SavedResumeArchive[];
};

const STYLES = {
  dashboard: {
    section: "rounded-2xl border border-white/10 bg-navy-900/60 p-6",
    title: "text-lg font-semibold text-white",
    subtitle: "mt-1 text-sm text-slate-400",
    input:
      "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40",
    listWrap: "mt-5 space-y-2",
    dateButton:
      "flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition-all hover:border-blue-500/30 hover:bg-blue-500/[0.06]",
    dateButtonOpen: "border-blue-500/35 bg-blue-500/[0.08]",
    dateLabel: "text-sm font-semibold text-white",
    dateMeta: "text-xs text-slate-400",
    chevron: "h-4 w-4 shrink-0 text-slate-400 transition-transform",
    groupPanel: "overflow-hidden rounded-xl border border-white/10",
    tableWrap: "overflow-x-auto",
    thead: "border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wider text-slate-500",
    rowHover: "align-top hover:bg-white/[0.02]",
    bidTime: "whitespace-nowrap px-4 py-3 text-slate-300 tabular-nums",
    company: "px-4 py-3 font-medium text-white",
    jobTitle: "px-4 py-3 text-slate-200",
    description: "hidden max-w-md px-4 py-3 text-slate-400 lg:table-cell",
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
    listWrap: "mt-5 space-y-2",
    dateButton:
      "flex w-full items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-left transition-all hover:border-blue-500/35 hover:bg-blue-50/80 dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-blue-500/30 dark:hover:bg-blue-500/[0.06]",
    dateButtonOpen:
      "border-blue-500/40 bg-blue-50/90 dark:border-blue-500/35 dark:bg-blue-500/[0.08]",
    dateLabel: "text-sm font-semibold text-slate-900 dark:text-white",
    dateMeta: "text-xs text-slate-500 dark:text-slate-400",
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
    description: "hidden max-w-md px-4 py-3 text-slate-500 dark:text-slate-400 lg:table-cell",
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
    dateKey: `${year}-${month}-${day}`,
    dateLabel: new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date),
    timeLabel: new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date),
  };
}

function formatBidAt(iso: string): string {
  const parts = parseBidAt(iso);
  if (!parts) return iso;
  return `${parts.dateLabel} ${parts.timeLabel}`;
}

function truncate(text: string, max = 140): string {
  const trimmed = text.trim();
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
    parts?.dateLabel ?? "",
    parts?.timeLabel ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function sortByBidDate(items: SavedResumeArchive[]): SavedResumeArchive[] {
  return [...items].sort((a, b) => new Date(b.bidAt).getTime() - new Date(a.bidAt).getTime());
}

function groupByBidDate(items: SavedResumeArchive[]): DateGroup[] {
  const groups = new Map<string, DateGroup>();

  for (const item of items) {
    const parts = parseBidAt(item.bidAt);
    const dateKey = parts?.dateKey ?? item.bidAt;
    const dateLabel = parts?.dateLabel ?? item.bidAt;
    const existing = groups.get(dateKey);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(dateKey, { dateKey, dateLabel, items: [item] });
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      items: sortByBidDate(group.items),
    }))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

function ApplicationRows({
  items,
  styles,
  downloadingKey,
  onPreview,
  onDownload,
}: {
  items: SavedResumeArchive[];
  styles: (typeof STYLES)["dashboard"] | (typeof STYLES)["resume"];
  downloadingKey: string | null;
  onPreview: (item: SavedResumeArchive) => void;
  onDownload: (item: SavedResumeArchive, format: "docx" | "pdf") => void;
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
              <th className="hidden px-4 py-3 font-medium lg:table-cell">Job description</th>
              <th className="px-4 py-3 font-medium">Resume</th>
              <th className="px-4 py-3 font-medium text-right">Download</th>
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {items.map((item) => {
              const docxKey = `${item.id}:docx`;
              const pdfKey = `${item.id}:pdf`;
              const timeLabel = parseBidAt(item.bidAt)?.timeLabel ?? "—";

              return (
                <tr key={item.id} className={styles.rowHover}>
                  <td className={styles.bidTime}>{timeLabel}</td>
                  <td className={styles.company}>{item.companyName}</td>
                  <td className={styles.jobTitle}>{item.jobTitle}</td>
                  <td className={styles.description}>
                    <span title={item.jobDescription}>{truncate(item.jobDescription)}</span>
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
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<SavedResumeArchive | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

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

  const dateGroups = useMemo(() => groupByBidDate(visibleItems), [visibleItems]);

  useEffect(() => {
    if (!debouncedSearch.trim()) return;
    setExpandedDates(new Set(dateGroups.map((group) => group.dateKey)));
  }, [debouncedSearch, dateGroups]);

  function toggleDate(dateKey: string) {
    setExpandedDates((current) => {
      const next = new Set(current);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
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

  return (
    <section className={styles.section}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className={styles.title}>Saved resumes</h2>
          <p className={styles.subtitle}>
            Grouped by bid date — click a date to expand applications. Search by company, title,
            description, or file name.
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

      <div className={styles.listWrap}>
        {loading ? (
          <div className={styles.empty}>
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              Loading saved resumes…
            </span>
          </div>
        ) : dateGroups.length === 0 ? (
          <div className={styles.empty}>
            {debouncedSearch
              ? "No applications match your search."
              : "No saved resumes yet. Apply a tailored resume from New resume to save one here."}
          </div>
        ) : (
          dateGroups.map((group) => {
            const expanded = expandedDates.has(group.dateKey);
            const countLabel =
              group.items.length === 1 ? "1 application" : `${group.items.length} applications`;

            return (
              <div key={group.dateKey} className="space-y-2">
                <button
                  type="button"
                  onClick={() => toggleDate(group.dateKey)}
                  aria-expanded={expanded}
                  className={`${styles.dateButton} ${expanded ? styles.dateButtonOpen : ""}`}
                >
                  <svg
                    className={`${styles.chevron} ${expanded ? "rotate-90" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className={styles.dateLabel}>{group.dateLabel}</span>
                  <span className={styles.dateMeta}>{countLabel}</span>
                </button>

                {expanded && (
                  <ApplicationRows
                    items={group.items}
                    styles={styles}
                    downloadingKey={downloadingKey}
                    onPreview={(item) => void openPreview(item)}
                    onDownload={(item, format) => void handleDownload(item, format)}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

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
        onDownload={
          previewItem ? () => void handleDownload(previewItem, "pdf") : undefined
        }
      />
    </section>
  );
}
