"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { renderAsync } from "docx-preview";
import Modal from "@/components/ui/Modal";

interface DocxPreviewModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  blob: Blob | null;
  fileName: string;
  onDownload: () => void;
}

export default function DocxPreviewModal({
  open,
  onClose,
  title,
  blob,
  fileName,
  onDownload,
}: DocxPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLElement[]>([]);

  const showOnly = useCallback((index: number) => {
    pagesRef.current.forEach((el, i) => {
      el.style.display = i === index ? "" : "none";
    });
  }, []);

  useEffect(() => {
    if (!open || !blob) return;
    let cancelled = false;

    (async () => {
      setError("");
      setLoading(true);
      setPage(0);
      setTotalPages(0);
      pagesRef.current = [];
      try {
        const container = previewRef.current;
        if (!container || cancelled) return;
        container.innerHTML = "";
        await renderAsync(blob, container, undefined, {
          className: "docx",
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          ignoreWidth: false,
          ignoreHeight: false,
          experimental: true,
          trimXmlDeclaration: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
        });
        if (cancelled) return;
        const pageEls = Array.from(
          container.querySelectorAll<HTMLElement>(".docx-wrapper > section.docx")
        );
        pagesRef.current = pageEls;
        setTotalPages(pageEls.length);
        showOnly(0);
      } catch (err) {
        if (!cancelled) setError((err as Error).message || "Failed to render preview.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, blob, showOnly]);

  function goTo(index: number) {
    const clamped = Math.max(0, Math.min(index, totalPages - 1));
    setPage(clamped);
    showOnly(clamped);
    previewRef.current?.scrollTo({ top: 0 });
  }

  return (
    <Modal open={open} onClose={onClose} title={title} variant="center" className="max-w-4xl h-[90vh]">
      <div className="flex items-center justify-end gap-2 px-6 py-2 border-b border-slate-200 dark:border-white/[0.08] shrink-0">
        <button
          type="button"
          onClick={onDownload}
          disabled={!blob}
          className="text-sm font-semibold px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors"
        >
          Download {fileName}
        </button>
      </div>

      <div className="relative flex-1 overflow-auto bg-[#e9ecef] dark:bg-navy-950 min-h-[60vh]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500 dark:text-slate-400">
            Loading preview…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          </div>
        )}
        <div className="docx-preview-canvas" ref={previewRef} />
      </div>

      {totalPages > 0 && !loading && (
        <div className="flex items-center justify-center gap-4 px-6 py-3 border-t border-slate-200 dark:border-white/[0.08] shrink-0">
          <button
            type="button"
            onClick={() => goTo(page - 1)}
            disabled={page === 0}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-slate-900 dark:text-white disabled:opacity-40 transition-all"
          >
            ← Prev
          </button>
          <span className="text-sm text-slate-600 dark:text-slate-400 tabular-nums">
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => goTo(page + 1)}
            disabled={page === totalPages - 1}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-slate-900 dark:text-white disabled:opacity-40 transition-all"
          >
            Next →
          </button>
        </div>
      )}
    </Modal>
  );
}
