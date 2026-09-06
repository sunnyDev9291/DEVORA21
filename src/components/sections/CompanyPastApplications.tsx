"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  downloadBlob,
  fetchSavedResumeFile,
  listSavedResumes,
} from "@/lib/saved-resumes-api";
import type { SavedResumeArchive } from "@/lib/saved-resumes-types";
import { formatEstDateTime } from "@/lib/format-est-datetime";

const DEBOUNCE_MS = 350;
const MIN_QUERY_CHARS = 2;
const MAX_VISIBLE = 8;

type CompanyPastApplicationsProps = {
  companyName: string;
  disabled?: boolean;
  onUseJobDescription?: (item: SavedResumeArchive) => void;
};

function sortNewestFirst(items: SavedResumeArchive[]): SavedResumeArchive[] {
  return [...items].sort((a, b) => new Date(b.bidAt).getTime() - new Date(a.bidAt).getTime());
}

export default function CompanyPastApplications({
  companyName,
  disabled = false,
  onUseJobDescription,
}: CompanyPastApplicationsProps) {
  const listId = useId();
  const requestIdRef = useRef(0);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SavedResumeArchive[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = companyName.trim();
    if (trimmed.length < MIN_QUERY_CHARS) {
      setQuery("");
      setItems([]);
      setError("");
      setLoading(false);
      return;
    }

    const timer = window.setTimeout(() => setQuery(trimmed), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [companyName]);

  useEffect(() => {
    if (!query || disabled) {
      setItems([]);
      setError("");
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");

    void listSavedResumes({ company: query })
      .then((rows) => {
        if (requestId !== requestIdRef.current) return;
        setItems(sortNewestFirst(rows).slice(0, MAX_VISIBLE));
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        setItems([]);
        setError(err instanceof Error ? err.message : "Could not load past applications.");
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [query, disabled]);

  async function handleDownload(item: SavedResumeArchive, format: "docx" | "pdf") {
    const key = `${item.id}:${format}`;
    setDownloadingKey(key);
    try {
      const { blob, fileName } = await fetchSavedResumeFile(item.id, format);
      downloadBlob(blob, fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not download ${format.toUpperCase()}.`);
    } finally {
      setDownloadingKey(null);
    }
  }

  if (companyName.trim().length < MIN_QUERY_CHARS) return null;

  const visibleCount = items.length;
  const heading =
    loading && visibleCount === 0
      ? "Looking up past applications…"
      : visibleCount > 0
        ? `Past applications at this company (${visibleCount}${visibleCount >= MAX_VISIBLE ? "+" : ""})`
        : "Past applications at this company";

  return (
    <div
      className="mt-3 rounded-xl border border-orange-200/70 bg-orange-50/50 px-3.5 py-3 dark:border-orange-500/20 dark:bg-orange-500/[0.07]"
      aria-live="polite"
      aria-busy={loading}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800 dark:text-stone-100">{heading}</p>
        <Link
          href="/resume/saved"
          className="text-xs font-semibold text-orange-700 underline-offset-2 hover:underline dark:text-orange-300"
        >
          Open saved resumes →
        </Link>
      </div>

      {error ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p>
      ) : null}

      {!loading && !error && visibleCount === 0 ? (
        <p className="mt-2 text-xs text-slate-600 dark:text-stone-300">
          No saved resumes matched “{query}” yet.
        </p>
      ) : null}

      {visibleCount > 0 ? (
        <ul id={listId} className="mt-3 space-y-2">
          {items.map((item) => {
            const when = formatEstDateTime(item.bidAt) ?? item.bidAt;
            const docxKey = `${item.id}:docx`;
            const pdfKey = `${item.id}:pdf`;
            return (
              <li
                key={item.id}
                className="rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2.5 dark:border-white/[0.08] dark:bg-warm-950/40"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {item.jobTitle || "Untitled role"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      {item.companyName}
                      {when ? (
                        <>
                          {" · "}
                          <span className="font-bold text-orange-800 dark:text-orange-300">
                            {when}
                          </span>
                        </>
                      ) : null}
                    </p>
                    {item.resumeFileName ? (
                      <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                        {item.resumeFileName}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {onUseJobDescription && item.jobDescription?.trim() ? (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onUseJobDescription(item)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-orange-300 hover:text-orange-800 disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:border-orange-400/40 dark:hover:text-orange-200"
                      >
                        Use JD
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={disabled || downloadingKey === docxKey}
                      onClick={() => void handleDownload(item, "docx")}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-orange-300 hover:text-orange-800 disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:border-orange-400/40 dark:hover:text-orange-200"
                    >
                      {downloadingKey === docxKey ? "…" : "DOCX"}
                    </button>
                    <button
                      type="button"
                      disabled={disabled || downloadingKey === pdfKey}
                      onClick={() => void handleDownload(item, "pdf")}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-orange-300 hover:text-orange-800 disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:border-orange-400/40 dark:hover:text-orange-200"
                    >
                      {downloadingKey === pdfKey ? "…" : "PDF"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
