"use client";

import { useState } from "react";
import { ATS_PASS_THRESHOLD } from "@/lib/resume-ats";
import { RULE_KEEP_PASS_THRESHOLD } from "@/lib/resume-rule-keep-constants";
import { RESUME_PASS_THRESHOLD, RESUME_SCORE_MAX } from "@/lib/resume-unified-score";
import type { ResumeUnifiedScoreResult } from "@/lib/resume-types";
import type { ResumeImproveTarget } from "@/lib/resume-improve-target";
import { ResumeAtsScorePanel } from "@/components/ui/ResumeAtsScorePanel";
import { ResumeRuleKeepPanel } from "@/components/ui/ResumeRuleKeepPanel";
import { EvaluationHeroLoader } from "@/components/ui/ResumeStepLoader";

export interface ResumeScorePanelProps {
  score: ResumeUnifiedScoreResult | null;
  loading: boolean;
  error: string;
  onRecheck?: () => void;
  recheckDisabled?: boolean;
  customPrompt?: string;
  onImprove?: (target: ResumeImproveTarget) => void;
  improvingTargetId?: string;
}

function scoreColor(overall: number, passed: boolean): string {
  if (passed) return "text-emerald-500";
  if (overall >= 85) return "text-amber-500";
  return "text-red-500";
}

function scoreRingColor(overall: number, passed: boolean): string {
  if (passed) return "#10b981";
  if (overall >= 85) return "#f59e0b";
  return "#ef4444";
}

function ScoreRing({ overall, passed }: { overall: number; passed: boolean }) {
  const display = Math.min(Math.max(overall, 0), RESUME_SCORE_MAX);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (display / RESUME_SCORE_MAX) * circumference;

  return (
    <div className="relative h-32 w-32 shrink-0 mx-auto sm:mx-0">
      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-200 dark:text-white/10" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={scoreRingColor(overall, passed)}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold tabular-nums ${scoreColor(display, passed)}`}>{display}</span>
        <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">/ {RESUME_SCORE_MAX}</span>
      </div>
    </div>
  );
}

function ComponentBar({
  label,
  value,
  passed,
  passLabel,
}: {
  label: string;
  value: number;
  passed: boolean;
  passLabel: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</span>
        <span className="flex items-center gap-2 text-xs tabular-nums">
          <span className={passed ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
            {value}/100
          </span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[12px] font-bold ${
              passed ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
            }`}
          >
            {passed ? passLabel : "Needs work"}
          </span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${passed ? "bg-emerald-500" : "bg-gradient-to-r from-orange-500 to-sun-400"}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

export function ResumeScorePanel({
  score,
  loading,
  error,
  onRecheck,
  recheckDisabled,
  customPrompt = "",
  onImprove,
  improvingTargetId,
}: ResumeScorePanelProps) {
  const [atsExpanded, setAtsExpanded] = useState(true);
  const [rulesExpanded, setRulesExpanded] = useState(true);

  if (loading) {
    return (
      <EvaluationHeroLoader
        title="Evaluating resume score…"
        description="Running ATS keyword matching and custom rule checks"
        accent="violet"
      />
    );
  }

  if (error) {
    return (
      <div className="py-12 px-6 text-center">
        <p className="text-base font-semibold text-red-600 dark:text-red-400">Score evaluation failed</p>
        <p className="text-sm text-red-600/80 dark:text-red-300/80 mt-2">{error}</p>
        {onRecheck && (
          <button
            type="button"
            onClick={onRecheck}
            disabled={recheckDisabled}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  if (!score) return null;

  return (
    <div className="overflow-hidden">
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col sm:flex-row gap-5 sm:gap-6">
          <ScoreRing overall={score.overall} passed={score.passed} />

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">Resume Score</h4>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  score.passed
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                }`}
              >
                {score.passed ? `Passed (${RESUME_PASS_THRESHOLD}+)` : `Below ${RESUME_PASS_THRESHOLD}% target`}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{score.summary}</p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <ComponentBar
            label="ATS match"
            value={score.ats.overall}
            passed={score.ats.passed}
            passLabel={`${ATS_PASS_THRESHOLD}+`}
          />
          {score.hasRules && (
            <ComponentBar
              label="Custom rules"
              value={score.ruleKeep.overall}
              passed={score.ruleKeep.passed}
              passLabel={`${RULE_KEEP_PASS_THRESHOLD}+`}
            />
          )}
        </div>
      </div>

      <div className="border-t border-violet-500/10">
        <button
          type="button"
          onClick={() => setAtsExpanded((open) => !open)}
          className="flex w-full items-center justify-between gap-3 px-5 py-3 sm:px-6 text-left hover:bg-orange-500/[0.04] transition-colors"
          aria-expanded={atsExpanded}
        >
          <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            ATS breakdown
          </p>
          <svg
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${atsExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {atsExpanded && (
          <div className="px-5 pb-4 sm:px-6 border-t border-violet-500/10">
            <ResumeAtsScorePanel
              score={score.ats}
              loading={false}
              error=""
              embedded
              onImprove={onImprove}
              improvingTargetId={improvingTargetId}
            />
          </div>
        )}
      </div>

      {score.hasRules && (
        <div className="border-t border-emerald-500/10">
          <button
            type="button"
            onClick={() => setRulesExpanded((open) => !open)}
            className="flex w-full items-center justify-between gap-3 px-5 py-3 sm:px-6 text-left hover:bg-emerald-500/[0.04] transition-colors"
            aria-expanded={rulesExpanded}
          >
            <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Custom rules ({score.ruleKeep.passedRules}/{score.ruleKeep.totalRules} passed)
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
            <div className="px-5 pb-4 sm:px-6 border-t border-emerald-500/10">
              <ResumeRuleKeepPanel
                score={score.ruleKeep}
                loading={false}
                error=""
                customPrompt={customPrompt}
                embedded
                onImprove={onImprove}
                improvingTargetId={improvingTargetId}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
