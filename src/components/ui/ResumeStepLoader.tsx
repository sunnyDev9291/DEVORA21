"use client";

import type { ReactNode } from "react";

export type StepLoaderAccent = "violet" | "sky" | "emerald" | "blue";

const ACCENT = {
  violet: {
    box: "bg-violet-500/15",
    spinner: "text-violet-500",
    border: "border-violet-500/15",
  },
  sky: {
    box: "bg-sky-500/15",
    spinner: "text-sky-500",
    border: "border-sky-500/15",
  },
  emerald: {
    box: "bg-emerald-500/15",
    spinner: "text-emerald-500",
    border: "border-emerald-500/15",
  },
  blue: {
    box: "bg-blue-500/15",
    spinner: "text-blue-500",
    border: "border-blue-500/15",
  },
} as const;

function StepSpinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function StepCheck({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`text-emerald-500 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

interface EvaluationHeroLoaderProps {
  title: string;
  description: string;
  accent?: StepLoaderAccent;
}

/** Large centered loader — matches ATS score evaluation hero. */
export function EvaluationHeroLoader({
  title,
  description,
  accent = "violet",
}: EvaluationHeroLoaderProps) {
  const colors = ACCENT[accent];

  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${colors.box}`}>
        <StepSpinner className={`h-6 w-6 ${colors.spinner}`} />
      </div>
      <p className="text-base font-semibold text-slate-900 dark:text-white">{title}</p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

interface EvaluationRowLoaderProps {
  title: string;
  description: string;
  accent?: StepLoaderAccent;
  state?: "loading" | "done" | "pending";
  className?: string;
}

/** Compact row loader — matches human tone / rule keep rows. */
export function EvaluationRowLoader({
  title,
  description,
  accent = "sky",
  state = "loading",
  className = "",
}: EvaluationRowLoaderProps) {
  const colors = ACCENT[accent];

  let icon: ReactNode;
  if (state === "done") {
    icon = <StepCheck />;
  } else if (state === "pending") {
    icon = <span className="h-2 w-2 rounded-full bg-slate-400/60 dark:bg-slate-500" aria-hidden="true" />;
  } else {
    icon = <StepSpinner className={`h-5 w-5 ${colors.spinner}`} />;
  }

  const iconBoxClass =
    state === "pending"
      ? "bg-slate-100 dark:bg-white/[0.04]"
      : state === "done"
        ? "bg-emerald-500/10"
        : colors.box;

  return (
    <div className={`border-t border-slate-200/80 dark:border-white/[0.06] px-5 py-4 sm:px-6 ${className}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBoxClass}`}>
          {icon}
        </div>
        <div className="min-w-0 text-left">
          <p
            className={`text-sm font-semibold ${
              state === "pending"
                ? "text-slate-500 dark:text-slate-500"
                : "text-slate-900 dark:text-white"
            }`}
          >
            {title}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
    </div>
  );
}

interface EvaluationStepStackProps {
  children: ReactNode;
  className?: string;
}

/** Wrapper so stacked evaluation loaders share one card surface. */
export function EvaluationStepStack({ children, className = "" }: EvaluationStepStackProps) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/50 dark:border-white/[0.06] dark:bg-white/[0.02] ${className}`}
    >
      {children}
    </div>
  );
}
