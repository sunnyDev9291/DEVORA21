"use client";

import { RESUME_PHASE_LABELS, type ResumeGenerationPhase } from "@/lib/resume-prompt";

const PHASE_ORDER: ResumeGenerationPhase[] = [
  "starting",
  "analyzing",
  "title",
  "summary",
  "skills",
  "experiences",
  "finalizing",
];

interface ResumeThinkingProgressProps {
  phase: ResumeGenerationPhase;
  jobTitle?: string;
}

function phaseIndex(phase: ResumeGenerationPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

export default function ResumeThinkingProgress({ phase, jobTitle }: ResumeThinkingProgressProps) {
  const currentIdx = Math.max(0, phaseIndex(phase));
  const progress = Math.min(100, Math.round(((currentIdx + 1) / PHASE_ORDER.length) * 100));
  const status = RESUME_PHASE_LABELS[phase] ?? "Generating your resume…";

  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.06] dark:bg-blue-500/[0.08] px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {status}
          {jobTitle ? (
            <span className="text-slate-500 dark:text-slate-400 font-normal"> · {jobTitle}</span>
          ) : null}
        </p>
        <span className="text-xs font-semibold tabular-nums text-blue-600 dark:text-blue-400 shrink-0">
          {progress}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-200/80 dark:bg-white/[0.08] overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Resume generation progress"
        />
      </div>
    </div>
  );
}
