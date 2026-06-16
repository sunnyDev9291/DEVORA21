"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

interface PdfPreviewModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  fileName?: string;
  sourceUrl?: string | null;
  loading?: boolean;
  error?: string;
  onDownload?: () => void;
}

export default function PdfPreviewModal({
  open,
  onClose,
  title,
  subtitle,
  fileName,
  sourceUrl,
  loading = false,
  error = "",
  onDownload,
}: PdfPreviewModalProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const ready = !!sourceUrl && !loading && !error;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex h-full w-full items-stretch justify-center"
      style={{ height: "100dvh", width: "100vw" }}
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 dark:bg-black/55 backdrop-blur-md animate-backdrop-enter cursor-default"
        onClick={onClose}
        aria-label="Close preview"
      />

      <div
        className="relative z-10 flex h-full w-full max-w-6xl flex-col overflow-hidden bg-white dark:bg-navy-900 shadow-2xl shadow-black/20 animate-dialog-enter"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label="PDF preview"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 dark:border-white/[0.08] bg-white/95 dark:bg-navy-900/95 px-4 sm:px-5 h-12 backdrop-blur-sm">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/15">
            <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-sm font-bold text-slate-900 dark:text-white">
              {title}
            </h2>
            {(subtitle || fileName) && (
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                {subtitle ?? fileName}
              </p>
            )}
          </div>

          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              disabled={!ready}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/[0.06] dark:hover:text-white transition-colors"
            aria-label="Close preview"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-slate-100 dark:bg-navy-950">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div
                className="bg-white rounded-sm shadow-xl animate-pulse"
                style={{ width: "min(80%, 480px)", aspectRatio: "8.5 / 11" }}
              />
              <p className="text-sm text-slate-600 dark:text-slate-400">Generating PDF…</p>
            </div>
          )}

          {error && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <p className="text-sm text-red-500 dark:text-red-400 max-w-md">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:underline"
              >
                Close
              </button>
            </div>
          )}

          {!loading && !error && !ready && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">Waiting for PDF…</p>
            </div>
          )}

          {ready && sourceUrl && (
            <object
              data={sourceUrl}
              type="application/pdf"
              className="h-full w-full bg-white"
              aria-label={fileName ?? "Resume PDF preview"}
            >
              <iframe
                title={fileName ?? "Resume PDF preview"}
                src={sourceUrl}
                className="h-full w-full border-0 bg-white"
              />
            </object>
          )}
        </div>

        <footer className="relative flex shrink-0 items-center justify-center gap-3 border-t border-slate-200 dark:border-white/[0.08] bg-white/95 dark:bg-navy-900/95 h-11 px-4 backdrop-blur-sm">
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {loading ? "Preparing your PDF…" : ready ? "PDF preview" : error ? "PDF unavailable" : "Waiting…"}
          </span>

          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              disabled={!ready}
              className="sm:hidden absolute right-3 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              Download PDF
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body
  );
}
