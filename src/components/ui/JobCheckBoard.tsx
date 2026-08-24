"use client";

import { useEffect, useRef } from "react";
import Modal from "@/components/ui/Modal";

type JobCheckBoardProps = {
  open: boolean;
  loading: boolean;
  error: string;
  output: string;
  jobTitle: string;
  companyName: string;
  onClose: () => void;
  onRetry?: () => void;
};

export default function JobCheckBoard({
  open,
  loading,
  error,
  output,
  jobTitle,
  companyName,
  onClose,
  onRetry,
}: JobCheckBoardProps) {
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = outputRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [output, loading]);

  const subtitle = [jobTitle.trim(), companyName.trim()].filter(Boolean).join(" · ");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Job Check"
      ariaLabel="Job Check results"
      className="max-w-2xl"
    >
      <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
        <div className="px-6 pt-1 pb-3 border-b border-slate-100 dark:border-white/[0.06] shrink-0 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400 truncate min-w-0">
            {subtitle || "Analyze company, role, and job description"}
          </p>
          {loading ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
              Analyzing…
            </span>
          ) : output && !error ? (
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
              Complete
            </span>
          ) : null}
        </div>

        <div
          ref={outputRef}
          className="flex-1 overflow-y-auto px-6 py-5 min-h-[240px] max-h-[min(60dvh,480px)]"
          aria-live="polite"
          aria-busy={loading}
        >
          {error ? (
            <div className="rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3">
              <p className="text-sm text-red-600 dark:text-red-300 whitespace-pre-wrap">{error}</p>
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-3 inline-flex items-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                >
                  Try again
                </button>
              ) : null}
            </div>
          ) : output ? (
            <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800 dark:text-slate-100 font-sans">
              {output}
              {loading ? (
                <span className="inline-block w-2 h-4 ml-0.5 bg-sky-500/70 animate-pulse align-middle" />
              ) : null}
            </pre>
          ) : loading ? (
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 py-10 justify-center">
              <svg className="w-5 h-5 animate-spin text-sky-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Waiting for Job Check analysis…
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">
              Job Check results will appear here.
            </p>
          )}
        </div>

        {!loading ? (
          <div className="shrink-0 px-6 py-4 border-t border-slate-200 dark:border-white/[0.08] flex justify-end gap-2">
            {output && !error && onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center rounded-xl border border-slate-200 dark:border-white/[0.12] px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
              >
                Re-run check
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-xl bg-slate-900 dark:bg-white px-4 py-2 text-sm font-semibold text-white dark:text-slate-900 hover:opacity-90"
            >
              Close
            </button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
