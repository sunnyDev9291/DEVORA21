"use client";

import {
  useResumeApplyType,
  type ResumeApplyType,
} from "@/components/sections/ResumeApplyTypeContext";

const OPTIONS: Array<{ value: ResumeApplyType; label: string; hint: string }> = [
  {
    value: "linkedin-easy-apply",
    label: "LinkedIn Easy Apply",
    hint: "Tailor for LinkedIn Easy Apply",
  },
  {
    value: "apply",
    label: "Apply",
    hint: "Tailor for a full application",
  },
];

export default function ResumeApplyTypeToggle() {
  const { applyType, setApplyType } = useResumeApplyType();

  return (
    <div className="mb-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Apply type
      </p>
      <div
        className="inline-flex w-full max-w-lg rounded-xl border border-slate-200/80 bg-white/90 p-1 shadow-lg shadow-slate-200/40 backdrop-blur-sm dark:border-white/[0.10] dark:bg-navy-900/90 dark:shadow-black/30 sm:w-auto"
        role="radiogroup"
        aria-label="Apply type"
      >
        {OPTIONS.map((option) => {
          const active = applyType === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              title={option.hint}
              onClick={() => setApplyType(option.value)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-all sm:flex-none sm:px-6 ${
                active
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
