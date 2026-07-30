"use client";

import type { ResumeFromJobStep } from "@/lib/resume-from-job-api";

const STATE_STYLES: Record<
  ResumeFromJobStep["state"],
  { dot: string; text: string; label: string }
> = {
  pending: {
    dot: "border-slate-300 bg-transparent dark:border-white/20",
    text: "text-slate-400 dark:text-slate-500",
    label: "Pending",
  },
  active: {
    dot: "border-blue-500 bg-blue-500 animate-pulse",
    text: "text-blue-700 dark:text-blue-300 font-semibold",
    label: "In progress",
  },
  done: {
    dot: "border-emerald-500 bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    label: "Done",
  },
  error: {
    dot: "border-red-500 bg-red-500",
    text: "text-red-600 dark:text-red-300 font-semibold",
    label: "Failed",
  },
};

interface ResumeFromJobProgressProps {
  message: string;
  progressPercent: number;
  steps: ResumeFromJobStep[];
  jobTitle?: string;
  companyName?: string;
  warning?: string;
}

export default function ResumeFromJobProgress({
  message,
  progressPercent,
  steps,
  jobTitle,
  companyName,
  warning,
}: ResumeFromJobProgressProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(progressPercent)));

  return (
    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.04] p-5 dark:bg-blue-500/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{message || "Working…"}</p>
          {(jobTitle || companyName) && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
              {[jobTitle, companyName].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums text-blue-700 dark:text-blue-300">
          {clamped}%
        </span>
      </div>

      <div
        className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/[0.08]"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Resume generation progress"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-[width] duration-500 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>

      <ol className="mt-5 space-y-2.5">
        {steps.map((step) => {
          const style = STATE_STYLES[step.state];
          return (
            <li key={step.key} className="flex items-center gap-3">
              <span
                className={`flex h-3.5 w-3.5 shrink-0 rounded-full border-2 ${style.dot}`}
                aria-hidden
              />
              <span className={`text-sm ${style.text}`}>{step.label}</span>
              <span className="sr-only">{style.label}</span>
            </li>
          );
        })}
      </ol>

      {warning ? (
        <p className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          {warning}
        </p>
      ) : null}
    </div>
  );
}
