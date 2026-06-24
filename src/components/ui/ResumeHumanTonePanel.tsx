"use client";

import { HUMAN_TONE_PASS_THRESHOLD, HUMAN_TONE_SCORE_MAX } from "@/lib/resume-human-tone";
import type { HumanToneScoreResult } from "@/lib/resume-types";
import { EvaluationRowLoader } from "@/components/ui/ResumeStepLoader";

export interface ResumeHumanTonePanelProps {
  score: HumanToneScoreResult | null;
  loading: boolean;
  error: string;
}

function scoreColor(overall: number): string {
  if (overall >= HUMAN_TONE_PASS_THRESHOLD) return "text-sky-500";
  if (overall >= 65) return "text-amber-500";
  return "text-red-500";
}

function scoreRingColor(overall: number): string {
  if (overall >= HUMAN_TONE_PASS_THRESHOLD) return "#0ea5e9";
  if (overall >= 65) return "#f59e0b";
  return "#ef4444";
}

function ToneRing({ overall }: { overall: number }) {
  const display = Math.min(Math.max(overall, 0), HUMAN_TONE_SCORE_MAX);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (display / HUMAN_TONE_SCORE_MAX) * circumference;

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="7" className="text-slate-200 dark:text-white/10" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={scoreRingColor(overall)}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold tabular-nums ${scoreColor(display)}`}>{display}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">/ {HUMAN_TONE_SCORE_MAX}</span>
      </div>
    </div>
  );
}

export function ResumeHumanTonePanel({ score, loading, error }: ResumeHumanTonePanelProps) {
  if (loading && !score) {
    return (
      <EvaluationRowLoader
        title="Evaluating human tone…"
        description="Natural wording, variety, and recruiter readability"
        accent="sky"
      />
    );
  }

  if (error) {
    return (
      <div className="border-t border-sky-500/15 bg-sky-500/[0.03] px-5 py-4 sm:px-6">
        <p className="text-sm font-semibold text-red-600 dark:text-red-400">Human tone check failed</p>
        <p className="text-xs text-red-600/80 dark:text-red-300/80 mt-1">{error}</p>
      </div>
    );
  }

  if (!score) return null;

  return (
    <div className="border-t border-sky-500/15 bg-gradient-to-b from-sky-500/[0.04] to-transparent">
      <div className="px-5 py-5 sm:px-6">
        <div className="flex gap-4 items-start">
          <ToneRing overall={score.overall} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <h4 className="text-base font-bold text-slate-900 dark:text-white">Human Tone Score</h4>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  score.passed
                    ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                }`}
              >
                {score.passed ? `Natural (${HUMAN_TONE_PASS_THRESHOLD}+)` : `Below ${HUMAN_TONE_PASS_THRESHOLD}%`}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{score.summary}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
              Separate from ATS — measures recruiter readability, not keyword match.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {score.breakdown.map((item) => (
            <div key={item.category}>
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{item.category}</span>
                <span className="text-[10px] tabular-nums text-slate-500">{item.score}/{item.maxScore}</span>
              </div>
              <div className="h-1 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 transition-all duration-700"
                  style={{ width: `${item.maxScore ? (item.score / item.maxScore) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {score.flags && score.flags.length > 0 && (
        <div className="px-5 py-3 sm:px-6 border-t border-sky-500/10">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1.5">
            Buzzword flags
          </p>
          <div className="flex flex-wrap gap-1.5">
            {score.flags.map((flag) => (
              <span
                key={flag}
                className="inline-block rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200"
              >
                {flag}
              </span>
            ))}
          </div>
        </div>
      )}

      {score.recommendations.length > 0 && (
        <div className="px-5 py-3 sm:px-6 border-t border-sky-500/10 bg-sky-500/[0.02]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Tips for a more human tone
          </p>
          <ol className="space-y-1 list-decimal list-inside">
            {score.recommendations.map((rec) => (
              <li key={rec} className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                {rec}
              </li>
            ))}
          </ol>
        </div>
      )}

      {score.gates && score.gates.length > 0 && (
        <div className="px-5 py-3 sm:px-6 border-t border-sky-500/10">
          <ul className="space-y-1">
            {score.gates.map((gate) => (
              <li key={gate.name} className="flex items-start gap-1.5 text-[10px]">
                <span className={`shrink-0 font-bold ${gate.passed ? "text-sky-500" : "text-red-500"}`}>
                  {gate.passed ? "✓" : "✗"}
                </span>
                <span className="text-slate-600 dark:text-slate-300">
                  <span className="font-medium">{gate.name}</span>
                  <span className="text-slate-400"> — {gate.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
