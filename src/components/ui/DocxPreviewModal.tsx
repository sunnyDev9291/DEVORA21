"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useDocxPreview } from "@/hooks/useDocxPreview";
import { useDocxFitScale } from "@/hooks/useDocxFitScale";

const INITIAL_ZOOM = 0.75;

interface DocxPreviewModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  blob?: Blob | null;
  sourceUrl?: string | null;
  fileName?: string;
  onDownload?: () => void;
}

export default function DocxPreviewModal({
  open,
  onClose,
  title,
  subtitle,
  blob,
  sourceUrl,
  fileName,
  onDownload,
}: DocxPreviewModalProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const source = sourceUrl ?? blob ?? null;
  const { previewRef, styleRef, pagesRef, viewportRef, loading, error, page, totalPages, goTo } =
    useDocxPreview(open, source);

  const ready = !loading && totalPages > 0 && !error;
  const { pageSize, fitWidthScale } = useDocxFitScale(viewportRef, pagesRef, page, ready);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);

  const displayScale = zoom;
  const displayPercent = Math.round(zoom * 100);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) setZoom(INITIAL_ZOOM);
  }, [open, sourceUrl, blob]);

  useEffect(() => {
    setZoom(INITIAL_ZOOM);
  }, [page]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && totalPages > 0) goTo(page - 1);
      if (e.key === "ArrowRight" && totalPages > 0) goTo(page + 1);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, page, totalPages, goTo]);

  useEffect(() => {
    viewportRef.current?.scrollTo({ top: 0, left: 0 });
  }, [page, viewportRef]);

  if (!open || !mounted) return null;

  const scaledW = pageSize.w * displayScale;
  const scaledH = pageSize.h * displayScale;

  const renderPaginationControls = (className = "") =>
    ready ? (
      <div
        className={`flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50/90 dark:bg-white/[0.04] p-0.5 shrink-0 ${className}`}
      >
        <button
          type="button"
          onClick={() => goTo(page - 1)}
          disabled={page === 0}
          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 transition-colors"
          aria-label="Previous page"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="px-2 text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300 min-w-[4.5rem] text-center">
          {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => goTo(page + 1)}
          disabled={page >= totalPages - 1}
          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 transition-colors"
          aria-label="Next page"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    ) : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex h-full w-full items-stretch justify-center pointer-events-none"
      style={{ height: "100dvh", width: "100vw" }}
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-slate-950/45 dark:bg-black/55 backdrop-blur-md animate-backdrop-enter pointer-events-none"
        aria-hidden="true"
      />

      <div
        className="docx-preview-dialog docx-preview-dialog--modal relative z-10 flex h-full w-full max-w-6xl flex-col overflow-hidden bg-transparent shadow-2xl shadow-black/20 animate-dialog-enter pointer-events-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label="Document preview"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 dark:border-white/[0.08] bg-white/95 dark:bg-warm-900/95 px-4 sm:px-5 h-12 backdrop-blur-sm">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/15">
            <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-sm font-bold text-slate-900 dark:text-white">
              {title}
            </h2>
            {(subtitle || fileName) && (
              <p className="truncate text-[13px] text-slate-500 dark:text-slate-400 hidden sm:block">
                {subtitle ?? fileName}
              </p>
            )}
          </div>

          {renderPaginationControls("hidden md:flex")}

          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50/90 dark:bg-white/[0.04] p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
              disabled={!ready}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 transition-colors"
              aria-label="Zoom out"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="px-2 text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300 min-w-[3rem] text-center">
              {ready ? `${displayPercent}%` : "—"}
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))}
              disabled={!ready}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 transition-colors"
              aria-label="Zoom in"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setZoom(fitWidthScale)}
              disabled={!ready || Math.abs(zoom - fitWidthScale) < 0.02}
              className="px-2 py-1 rounded-md text-[13px] font-semibold text-orange-600 dark:text-orange-400 hover:bg-white dark:hover:bg-navy-800 disabled:opacity-40 transition-colors"
              title="Fit width"
            >
              Fit
            </button>
          </div>

          {onDownload && fileName && (
            <button
              type="button"
              onClick={onDownload}
              disabled={!blob && !source}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
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

        <div
          ref={viewportRef}
          className="relative flex-1 min-h-0 w-full overflow-auto bg-transparent"
        >
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div
                className="bg-white rounded-sm shadow-xl animate-pulse"
                style={{ width: "min(80%, 480px)", aspectRatio: "8.5 / 11" }}
              />
              <p className="text-sm text-slate-600 dark:text-slate-400">Loading preview…</p>
            </div>
          )}

          {error && !loading && (
            <div className="px-6 text-center">
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:underline"
              >
                Close
              </button>
            </div>
          )}

          <div className="flex justify-center px-3 py-4 sm:px-6 sm:py-6 min-w-full">
            <div
              className="docx-preview-fit-host"
              style={
                pageSize.w > 0
                  ? { width: scaledW, height: scaledH, flexShrink: 0 }
                  : { position: "fixed", left: -99999, top: 0, visibility: "hidden", pointerEvents: "none" }
              }
            >
              <div ref={styleRef} className="docx-preview-style-host" aria-hidden="true" />
              <div
                ref={previewRef}
                className="docx-preview-canvas docx-preview-canvas--modal"
                style={
                  pageSize.w > 0
                    ? {
                        width: pageSize.w,
                        height: pageSize.h,
                        transform: `scale(${displayScale})`,
                        transformOrigin: "top left",
                      }
                    : undefined
                }
              />
            </div>
          </div>
        </div>

        <footer className="relative flex shrink-0 items-center justify-center gap-3 border-t border-slate-200 dark:border-white/[0.08] bg-white/95 dark:bg-warm-900/95 h-11 px-4 backdrop-blur-sm">
          {renderPaginationControls() ?? (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {loading ? "Loading…" : ""}
            </span>
          )}

          {onDownload && fileName && (
            <button
              type="button"
              onClick={onDownload}
              disabled={!blob && !source}
              className="sm:hidden absolute right-3 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              Download
            </button>
          )}

          {!onDownload && (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 rounded-lg border border-slate-200 dark:border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
            >
              Done
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body
  );
}
