"use client";

import { useState } from "react";
import type { FeedbackResolution, ResumeFieldChange } from "@/lib/resume-content-diff";
import { RESUME_SCORE_MAX } from "@/lib/resume-unified-score";

interface ResumeRegenerateDiffPanelProps {
  changes: ResumeFieldChange[];
  feedback?: FeedbackResolution | null;
  onDismiss?: () => void;
}

export default function ResumeRegenerateDiffPanel({
  changes,
  feedback,
  onDismiss,
}: ResumeRegenerateDiffPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [showUnchanged, setShowUnchanged] = useState(false);

  if (changes.length === 0 && !feedback) return null;

  const hasFeedback =
    feedback &&
    (feedback.solvedKeywords.length > 0 ||
      feedback.improvedCategories.length > 0 ||
      feedback.newlyPassedRules.length > 0 ||
      feedback.overallAfter !== feedback.overallBefore);

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-amber-500/20">
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Improvement changes
          </p>
          <p className="text-xs text-amber-800/80 dark:text-amber-200/80 mt-0.5">
            {changes.length} field{changes.length === 1 ? "" : "s"} updated from your previous draft
            {feedback
              ? ` · overall ${feedback.overallBefore}→${feedback.overallAfter}/${RESUME_SCORE_MAX}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-amber-800 dark:text-amber-200 hover:underline"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-5 py-4 space-y-4 max-h-[min(420px,50vh)] overflow-y-auto">
          {hasFeedback && feedback && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Feedback addressed
              </p>

              {feedback.solvedKeywords.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Missing keywords now included
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {feedback.solvedKeywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="inline-flex items-center rounded-lg bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-800 dark:text-emerald-200"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {feedback.improvedCategories.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Improved ATS categories
                  </p>
                  <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                    {feedback.improvedCategories.map((item) => (
                      <li key={item.category}>
                        {item.category}: {item.before}→{item.after}/{item.maxScore}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {feedback.newlyPassedRules.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Custom rules now passing
                  </p>
                  <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                    {feedback.newlyPassedRules.map((rule) => (
                      <li key={rule}>✓ {rule}</li>
                    ))}
                  </ul>
                </div>
              )}

              {feedback.stillMissingKeywords.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Still missing
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {feedback.stillMissingKeywords.slice(0, 8).join(", ")}
                  </p>
                </div>
              )}
            </div>
          )}

          {changes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  Sentence changes
                </p>
                <button
                  type="button"
                  onClick={() => setShowUnchanged((v) => !v)}
                  className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  {showUnchanged ? "Hide details" : "Show all changes"}
                </button>
              </div>

              <div className="space-y-3">
                {(showUnchanged ? changes : changes.slice(0, 6)).map((change) => (
                  <div
                    key={change.id}
                    className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.03] p-3"
                  >
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                      {change.label}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-through decoration-slate-400/70 leading-relaxed">
                      {change.before || "(empty)"}
                    </p>
                    <p className="text-sm text-emerald-800 dark:text-emerald-200 font-medium leading-relaxed mt-2">
                      {change.after || "(empty)"}
                    </p>
                  </div>
                ))}
                {!showUnchanged && changes.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setShowUnchanged(true)}
                    className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline"
                  >
                    Show {changes.length - 6} more change{changes.length - 6 === 1 ? "" : "s"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
