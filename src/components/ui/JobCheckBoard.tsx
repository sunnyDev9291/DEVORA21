"use client";

import { useEffect, useRef } from "react";

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

  if (!open) return null;

  const subtitle = [jobTitle.trim(), companyName.trim()].filter(Boolean).join(" · ");

  return (
    <section className="mt-6 rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-500/[0.06] to-indigo-500/[0.04] overflow-hidden shadow-sm">
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-sky-500/15 bg-white/40 dark:bg-white/[0.03]">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-300">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Job Check</h3>
              {subtitle ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {loading ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
              Analyzing…
            </span>
          ) : output ? (
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              Complete
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
            aria-label="Close Job Check board"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {error ? (
        <div className="px-5 py-4">
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
        </div>
      ) : (
        <div
          ref={outputRef}
          className="max-h-[420px] overflow-y-auto px-5 py-4"
          aria-live="polite"
          aria-busy={loading}
        >
          {output ? (
            <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800 dark:text-slate-100 font-sans">
              {output}
              {loading ? <span className="inline-block w-2 h-4 ml-0.5 bg-sky-500/70 animate-pulse align-middle" /> : null}
            </pre>
          ) : loading ? (
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 py-6">
              <svg className="w-5 h-5 animate-spin text-sky-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Waiting for Job Check analysis…
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
              Job Check results will appear here.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
