"use client";

import {
  formatInterviewRoundLabel,
  resolveNextInterviewRound,
} from "@/lib/saved-resumes-api";
import type { InterviewHistoryEntry } from "@/lib/saved-resumes-types";

type InterviewHistoryTimelineProps = {
  bidAt: string;
  interviewHistory?: InterviewHistoryEntry[];
  nextInterviewRound?: number;
  /** Compact chips only (for table cells). */
  compact?: boolean;
  className?: string;
};

function formatBidDate(bidAt: string): string {
  const date = new Date(bidAt);
  if (Number.isNaN(date.getTime())) return bidAt || "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function InterviewHistoryTimeline({
  bidAt,
  interviewHistory = [],
  nextInterviewRound,
  compact = false,
  className = "",
}: InterviewHistoryTimelineProps) {
  const history = [...interviewHistory].sort((a, b) => a.round - b.round);
  const next = resolveNextInterviewRound(history, nextInterviewRound);

  if (compact) {
    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {history.length === 0 ? (
          <span className="text-[11px] text-slate-400 dark:text-slate-500">No rounds yet</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {history.map((entry) => (
              <span
                key={`${entry.round}-${entry.downloadedAt}`}
                className="inline-flex rounded-full border border-orange-200/80 bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-900 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-100"
              >
                {formatInterviewRoundLabel(entry.round, entry.downloadedAt)}
              </span>
            ))}
          </div>
        )}
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Next · Round {next}
        </span>
      </div>
    );
  }

  return (
    <ol className={`relative space-y-0 ${className}`}>
      <li className="relative flex gap-3 pb-4">
        <div className="flex flex-col items-center">
          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-orange-500 ring-4 ring-orange-500/15" />
          <span className="mt-1 w-px flex-1 bg-slate-200 dark:bg-white/10" />
        </div>
        <div className="min-w-0 pb-1">
          <p className="text-xs font-semibold text-slate-900 dark:text-white">Bid / Applied</p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {formatBidDate(bidAt)}
          </p>
        </div>
      </li>

      {history.map((entry, index) => {
        const isLastCompleted = index === history.length - 1;
        return (
          <li key={`${entry.round}-${entry.downloadedAt}`} className="relative flex gap-3 pb-4">
            <div className="flex flex-col items-center">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 ring-4 ring-emerald-500/15" />
              <span
                className={`mt-1 w-px flex-1 ${
                  isLastCompleted ? "bg-slate-200 dark:bg-white/10" : "bg-slate-200 dark:bg-white/10"
                }`}
              />
            </div>
            <div className="min-w-0 pb-1">
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                {formatInterviewRoundLabel(entry.round, entry.downloadedAt)}
              </p>
            </div>
          </li>
        );
      })}

      <li className="relative flex gap-3">
        <div className="flex flex-col items-center">
          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-dashed border-slate-300 bg-white dark:border-white/25 dark:bg-transparent" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Round {next} · pending
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
            Recorded when you download for this round
          </p>
        </div>
      </li>
    </ol>
  );
}
