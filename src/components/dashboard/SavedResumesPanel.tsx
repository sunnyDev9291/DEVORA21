"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import {
  downloadBlob,
  fetchSavedResumeFile,
  listSavedResumes,
} from "@/lib/saved-resumes-api";
import type { SavedResumeArchive } from "@/lib/saved-resumes-types";

const PdfPreviewModal = dynamic(() => import("@/components/ui/PdfPreviewModal"), { ssr: false });

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40";

function formatBidAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function truncate(text: string, max = 140): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

function matchesSearch(item: SavedResumeArchive, query: string): boolean {
  if (!query) return true;
  const haystack = [
    item.jobTitle,
    item.companyName,
    item.jobDescription,
    item.resumeFileName,
    formatBidAt(item.bidAt),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function sortByBidDate(items: SavedResumeArchive[]): SavedResumeArchive[] {
  return [...items].sort((a, b) => new Date(b.bidAt).getTime() - new Date(a.bidAt).getTime());
}

export default function SavedResumesPanel() {
  const [items, setItems] = useState<SavedResumeArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

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

  async function openPreview(item: SavedResumeArchive) {
    setPreviewItem(item);
    setPreviewOpen(true);
    setPreviewBlob(null);
    setPreviewError("");
    setPreviewLoading(true);

    try {
      const { blob } = await fetchSavedResumeFile(item.id, "pdf");
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
      const { blob, fileName } = await fetchSavedResumeFile(item.id, format);
      downloadBlob(blob, fileName);
    } catch (err) {
      setError((err as Error).message || "Download failed.");
    } finally {
      setDownloadingKey(null);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-navy-900/60 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Saved resumes</h2>
          <p className="mt-1 text-sm text-slate-400">
            Applications you saved — newest bids first. Search by company, title, description, or file name.
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
            className={inputClass}
          />
        </div>
      </div>

      {error && (
        <div
          className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="mt-5 overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Bid date</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Job title</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">Job description</th>
              <th className="px-4 py-3 font-medium">Resume</th>
              <th className="px-4 py-3 font-medium text-right">Download</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    Loading saved resumes…
                  </span>
                </td>
              </tr>
            ) : visibleItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  {debouncedSearch
                    ? "No applications match your search."
                    : "No saved resumes yet. Apply a tailored resume from the Resume Builder to save one here."}
                </td>
              </tr>
            ) : (
              visibleItems.map((item) => {
                const docxKey = `${item.id}:docx`;
                const pdfKey = `${item.id}:pdf`;
                return (
                  <tr key={item.id} className="align-top hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                      {formatBidAt(item.bidAt)}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">{item.companyName}</td>
                    <td className="px-4 py-3 text-slate-200">{item.jobTitle}</td>
                    <td className="hidden max-w-md px-4 py-3 text-slate-400 lg:table-cell">
                      <span title={item.jobDescription}>{truncate(item.jobDescription)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void openPreview(item)}
                        className="font-mono text-xs text-blue-400 underline-offset-2 hover:text-blue-300 hover:underline"
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
                          onClick={() => void handleDownload(item, "docx")}
                        >
                          {downloadingKey === docxKey ? "…" : "DOCX"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={downloadingKey === pdfKey}
                          onClick={() => void handleDownload(item, "pdf")}
                        >
                          {downloadingKey === pdfKey ? "…" : "PDF"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
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
          previewItem
            ? () => void handleDownload(previewItem, "pdf")
            : undefined
        }
      />
    </section>
  );
}
