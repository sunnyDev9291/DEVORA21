"use client";

import { ATS_PASS_THRESHOLD, ATS_SCORE_MAX } from "@/lib/resume-ats";
import type { AtsScoreResult } from "@/lib/resume-types";
import { EvaluationHeroLoader } from "@/components/ui/ResumeStepLoader";

export interface ResumeAtsScorePanelProps {
  score: AtsScoreResult | null;
  loading: boolean;
  error: string;
  onRecheck?: () => void;
  recheckDisabled?: boolean;
}

function scoreColor(overall: number): string {
  if (overall >= ATS_PASS_THRESHOLD) return "text-emerald-500";
  if (overall >= 85) return "text-amber-500";
  return "text-red-500";
}

function scoreRingColor(overall: number): string {
  if (overall >= ATS_PASS_THRESHOLD) return "#10b981";
  if (overall >= 85) return "#f59e0b";
  return "#ef4444";
}

function ScoreRing({ overall }: { overall: number }) {
  const display = Math.min(Math.max(overall, 0), ATS_SCORE_MAX);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (display / ATS_SCORE_MAX) * circumference;

  return (
    <div className="relative h-32 w-32 shrink-0 mx-auto sm:mx-0">
      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-200 dark:text-white/10" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={scoreRingColor(overall)}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold tabular-nums ${scoreColor(display)}`}>{display}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">/ {ATS_SCORE_MAX}</span>
      </div>
    </div>
  );
}

export function ResumeAtsScorePanel({
  score,
  loading,
  error,
  onRecheck,
  recheckDisabled,
}: ResumeAtsScorePanelProps) {
  if (loading) {
    return (
      <EvaluationHeroLoader
        title="Evaluating ATS score…"
        description="Strict deterministic scoring against extracted job keywords — 7 pass gates required"
        accent="violet"
      />
    );
  }

  if (error) {
    return (
      <div className="py-12 px-6 text-center">
        <p className="text-base font-semibold text-red-600 dark:text-red-400">ATS evaluation failed</p>
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
          <ScoreRing overall={score.overall} />

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">ATS Match Score</h4>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  score.passed
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                }`}
              >
                {score.passed ? `Passed (${ATS_PASS_THRESHOLD}+)` : `Below ${ATS_PASS_THRESHOLD}% target`}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{score.summary}</p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {score.breakdown.map((item) => (
            <div key={item.category}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.category}</span>
                <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {item.score}/{item.maxScore}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-700"
                  style={{ width: `${item.maxScore ? (item.score / item.maxScore) * 100 : 0}%` }}
                />
              </div>
              {item.notes && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{item.notes}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {(score.matchedKeywords.length > 0 || score.missingKeywords.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 border-t border-violet-500/10">
          {score.matchedKeywords.length > 0 && (
            <div className="px-5 py-4 sm:px-6 border-b sm:border-b-0 sm:border-r border-violet-500/10">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
                Matched keywords
              </p>
              <div className="flex flex-wrap gap-1.5">
                {score.matchedKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-block rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-200"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
          {score.missingKeywords.length > 0 && (
            <div className="px-5 py-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">
                Missing / weak keywords
              </p>
              <div className="flex flex-wrap gap-1.5">
                {score.missingKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-block rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {score.recommendations.length > 0 && (
        <div className="px-5 py-4 sm:px-6 border-t border-violet-500/10 bg-slate-50/50 dark:bg-white/[0.02]">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Recommendations to improve score
          </p>
          <ol className="space-y-1.5 list-decimal list-inside">
            {score.recommendations.map((rec) => (
              <li key={rec} className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {rec}
              </li>
            ))}
          </ol>
        </div>
      )}

      {score.gates && score.gates.length > 0 && (
        <div className="px-5 py-4 sm:px-6 border-t border-violet-500/10">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Pass gates (all required for {ATS_PASS_THRESHOLD}% pass)
          </p>
          <ul className="space-y-1.5">
            {score.gates.map((gate) => (
              <li key={gate.name} className="flex items-start gap-2 text-xs">
                <span
                  className={`mt-0.5 shrink-0 font-bold ${gate.passed ? "text-emerald-500" : "text-red-500"}`}
                  aria-hidden="true"
                >
                  {gate.passed ? "✓" : "✗"}
                </span>
                <span className="text-slate-600 dark:text-slate-300">
                  <span className="font-medium">{gate.name}</span>
                  <span className="text-slate-400 dark:text-slate-500"> — {gate.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          {score.mustHaveCoverage !== undefined && (
            <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
              Algorithm: {score.algorithm ?? "strict"} · Must-have coverage: {score.mustHaveCoverage}%
            </p>
          )}
        </div>
      )}
    </div>
  );
}
