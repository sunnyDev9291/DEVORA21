"use client";

import { useState } from "react";
import { RULE_KEEP_PASS_THRESHOLD, RULE_KEEP_SCORE_MAX } from "@/lib/resume-rule-keep-constants";
import type { RuleKeepScoreResult } from "@/lib/resume-types";
import { EvaluationRowLoader } from "@/components/ui/ResumeStepLoader";

export interface ResumeRuleKeepPanelProps {
  score: RuleKeepScoreResult | null;
  loading: boolean;
  error: string;
  customPrompt?: string;
  /** When true, omit the hero ring and outer section styling. */
  embedded?: boolean;
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

export function ResumeRuleKeepPanel({
  score,
  loading,
  error,
  customPrompt = "",
  embedded = false,
}: ResumeRuleKeepPanelProps) {
  const [rulesExpanded, setRulesExpanded] = useState(true);
  const hasPrompt = Boolean(customPrompt.trim());

  if (loading && !score && !embedded) {
    return (
      <EvaluationRowLoader
        title="Checking custom rules…"
        description={hasPrompt ? "Auditing resume against your prompt rules" : "No custom prompt — Rule Keep skipped"}
        accent="emerald"
      />
    );
  }

  if (error && !embedded) {
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

  const content = (
    <>
      {!embedded && (
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
            {hasPrompt && !hasRules && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-2">
                Your prompt is loaded but no checkable rules were detected. Expand your prompt above to verify the text.
              </p>
            )}
          </div>
        </div>
      )}

      {hasRules && (
        <div className={embedded ? "mt-0" : "border-t border-emerald-500/10 mt-0"}>
          <button
            type="button"
            onClick={() => setRulesExpanded((open) => !open)}
            className="flex w-full items-center justify-between gap-3 px-5 py-3 sm:px-6 text-left hover:bg-emerald-500/[0.04] transition-colors"
            aria-expanded={rulesExpanded}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Parsed rules ({score.totalRules})
              {failedCount > 0 && (
                <span className="ml-2 text-amber-600 dark:text-amber-400">{failedCount} need attention</span>
              )}
            </p>
            <svg
              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${rulesExpanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {rulesExpanded && (
            <ul className="space-y-2 px-5 pb-4 sm:px-6">
              {score.rules.map((item, index) => (
                <li
                  key={item.id}
                  className={`rounded-xl border px-3 py-3 text-xs ${
                    item.passed
                      ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                      : "border-amber-500/25 bg-amber-500/[0.05]"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`shrink-0 font-bold mt-0.5 ${item.passed ? "text-emerald-500" : "text-amber-600 dark:text-amber-400"}`}
                      aria-hidden="true"
                    >
                      {item.passed ? "✓" : "✗"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Rule {index + 1}</span>
                        {item.category && item.category !== "General" && (
                          <span className="rounded-md bg-slate-200/80 dark:bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-400">
                            {item.category}
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold uppercase ${
                            item.passed ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {item.passed ? "Passed" : "Failed"}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{item.rule}</p>
                      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        <span className="font-medium text-slate-600 dark:text-slate-500">Auditor: </span>
                        {item.detail}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {score.recommendations.length > 0 && (
        <div className="px-5 py-3 sm:px-6 border-t border-emerald-500/10 bg-emerald-500/[0.02]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Recommendations
          </p>
          <ul className="space-y-1.5">
            {score.recommendations.map((rec) => (
              <li key={rec} className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed flex gap-2">
                <span className="text-amber-500 shrink-0">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!score.passed && hasRules && (
        <div className={`border-t border-emerald-500/10 bg-emerald-500/[0.02] ${embedded ? "py-3 mt-4" : "px-5 py-3 sm:px-6"}`}>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            Regenerate the draft to improve compliance with the failed rules above.
          </p>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="overflow-hidden">{content}</div>;
  }

  return (
    <div className="border-t border-emerald-500/15 bg-gradient-to-b from-emerald-500/[0.04] to-transparent">
      <div className="px-5 py-5 sm:px-6">{content}</div>
    </div>
  );
}
