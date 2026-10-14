"use client";

import InterviewHistoryTimeline from "@/components/ui/InterviewHistoryTimeline";
import type { OtherInterviewProgressItem } from "@/lib/saved-resumes-types";

type OtherInterviewProgressPanelProps = {
  companyName: string;
  loading: boolean;
  error: string;
  items: OtherInterviewProgressItem[];
  onBack: () => void;
};

export default function OtherInterviewProgressPanel({
  companyName,
  loading,
  error,
  items,
  onBack,
}: OtherInterviewProgressPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-800/70 dark:text-orange-300/80">
            Other progress
          </p>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-stone-900 dark:text-white">
            {companyName}
          </h3>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Profiles that already completed at least Round 1 at this company.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 rounded-xl border border-orange-200/70 bg-white/90 px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:border-orange-300 hover:bg-orange-50 dark:border-orange-500/20 dark:bg-white/[0.04] dark:text-stone-200 dark:hover:bg-orange-500/10"
        >
          Back
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-orange-200/70 bg-orange-50/40 px-4 py-10 text-center text-sm text-stone-500 dark:border-orange-500/20 dark:bg-orange-500/[0.06] dark:text-stone-300">
          Searching other profiles…
        </div>
      ) : error ? (
        <div
          className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
          role="alert"
        >
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-orange-200/70 bg-orange-50/40 px-4 py-10 text-center dark:border-orange-500/20 dark:bg-orange-500/[0.06]">
          <p className="text-sm font-medium text-stone-700 dark:text-stone-200">
            No other interview progress found
          </p>
          <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400">
            No other profiles have reached Round 1+ at this company yet.
          </p>
        </div>
      ) : (
        <ul className="max-h-[min(50dvh,24rem)] space-y-3 overflow-y-auto pr-0.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-orange-200/55 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-orange-500/15 dark:bg-warm-950/40"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-900 dark:text-white">
                  {item.profileName || item.profileEmail || item.profileId || "Unknown profile"}
                </p>
                {item.profileEmail && item.profileName ? (
                  <p className="mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">
                    {item.profileEmail}
                  </p>
                ) : null}
                <p className="mt-2 text-xs font-medium uppercase tracking-[0.08em] text-stone-600 dark:text-stone-300">
                  {item.jobTitle}
                </p>
              </div>
              <div className="mt-3 border-t border-orange-100/80 pt-3 dark:border-orange-500/10">
                <InterviewHistoryTimeline
                  bidAt={item.bidAt}
                  interviewHistory={item.interviewHistory}
                  nextInterviewRound={item.nextInterviewRound}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
