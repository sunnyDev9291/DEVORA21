"use client";

import { RULE_KEEP_PASS_THRESHOLD, RULE_KEEP_SCORE_MAX } from "@/lib/resume-rule-keep-constants";
import type { RuleKeepScoreResult } from "@/lib/resume-types";

export interface ResumeRuleKeepPanelProps {
  score: RuleKeepScoreResult | null;
  loading: boolean;
  error: string;
}

function scoreColor(overall: number, hasRules: boolean): string {
  if (!hasRules) return "text-slate-400";
  if (overall >= RULE_KEEP_PASS_THRESHOLD) return "text-emerald-500";
  if (overall >= 75) return "text-amber-500";
  return "text-red-500";
}

function scoreRingColor(overall: number, hasRules: boolean): string {
  if (!hasRules) return "#94a3b8";
  if (overall >= RULE_KEEP_PASS_THRESHOLD) return "#10b981";
  if (overall >= 75) return "#f59e0b";
  return "#ef4444";
}

function RuleRing({ overall, hasRules }: { overall: number; hasRules: boolean }) {
  const display = Math.min(Math.max(overall, 0), RULE_KEEP_SCORE_MAX);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (display / RULE_KEEP_SCORE_MAX) * circumference;

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="7" className="text-slate-200 dark:text-white/10" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={scoreRingColor(overall, hasRules)}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold tabular-nums ${scoreColor(overall, hasRules)}`}>{display}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">/ {RULE_KEEP_SCORE_MAX}</span>
      </div>
    </div>
  );
}

export function ResumeRuleKeepPanel({ score, loading, error }: ResumeRuleKeepPanelProps) {
  if (loading && !score) {
    return (
      <div className="border-t border-emerald-500/15 bg-emerald-500/[0.03] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
            <svg className="h-5 w-5 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Checking custom rules…</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Private rule audit — details are not shown</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-t border-emerald-500/15 bg-emerald-500/[0.03] px-5 py-4 sm:px-6">
        <p className="text-sm font-semibold text-red-600 dark:text-red-400">Rule Keep check failed</p>
        <p className="text-xs text-red-600/80 dark:text-red-300/80 mt-1">{error}</p>
      </div>
    );
  }

  if (!score) return null;

  const hasRules = score.totalRules > 0;
  const failedCount = score.totalRules - score.passedRules;

  return (
    <div className="border-t border-emerald-500/15 bg-gradient-to-b from-emerald-500/[0.04] to-transparent">
      <div className="px-5 py-5 sm:px-6">
        <div className="flex gap-4 items-start">
          <RuleRing overall={score.overall} hasRules={hasRules} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <h4 className="text-base font-bold text-slate-900 dark:text-white">Rule Keep Score</h4>
              {hasRules && (
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    score.passed
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {score.passed
                    ? `${score.passedRules}/${score.totalRules} passed (${RULE_KEEP_PASS_THRESHOLD}+)`
                    : `${score.passedRules}/${score.totalRules} passed`}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{score.summary}</p>
            {hasRules && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Rule text is private — only pass/fail counts are shown.
              </p>
            )}
          </div>
        </div>
      </div>

      {hasRules && failedCount > 0 && (
        <div className="px-5 pb-4 sm:px-6 border-t border-emerald-500/10">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-3">
            Results
          </p>
          <ul className="space-y-2 pb-2">
            {score.rules.map((item, index) => (
              <li
                key={item.id}
                className={`rounded-xl border px-3 py-2.5 text-xs ${
                  item.passed
                    ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                    : "border-amber-500/25 bg-amber-500/[0.05]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`shrink-0 font-bold ${item.passed ? "text-emerald-500" : "text-amber-600 dark:text-amber-400"}`}
                    aria-hidden="true"
                  >
                    {item.passed ? "✓" : "✗"}
                  </span>
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    Rule {index + 1} {item.passed ? "passed" : "needs attention"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!score.passed && hasRules && (
        <div className="px-5 py-3 sm:px-6 border-t border-emerald-500/10 bg-emerald-500/[0.02]">
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            Regenerate the draft to improve compliance with your private writing rules.
          </p>
        </div>
      )}
    </div>
  );
}
