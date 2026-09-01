"use client";

import { useState } from "react";

export interface ResumeScoringInstructionsPanelProps {
  customPrompt: string;
  defaultExpanded?: boolean;
}

export function ResumeScoringInstructionsPanel({
  customPrompt,
  defaultExpanded = false,
}: ResumeScoringInstructionsPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const trimmed = customPrompt.trim();

  if (!trimmed) {
    return (
      <div className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.02] px-5 py-4 sm:px-6">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          No custom prompt loaded. Upload or save prompt instructions in your profile to enable Rule Keep scoring.
        </p>
      </div>
    );
  }

  const lineCount = trimmed.split(/\n/).length;

  return (
    <div className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 sm:px-6 text-left hover:bg-slate-100/80 dark:hover:bg-white/[0.03] transition-colors"
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Your prompt instructions</h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {lineCount} line{lineCount === 1 ? "" : "s"} · used for generation and Rule Keep checks
          </p>
        </div>
        <svg
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-5 pb-4 sm:px-6">
          <pre className="max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 dark:border-white/[0.10] bg-white dark:bg-warm-950/50 p-4 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words font-mono leading-relaxed">
            {trimmed}
          </pre>
        </div>
      )}
    </div>
  );
}
