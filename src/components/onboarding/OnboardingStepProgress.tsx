"use client";

import { ONBOARDING_STEPS, type OnboardingStepId } from "@/lib/onboarding";

interface OnboardingStepProgressProps {
  currentStep: OnboardingStepId;
}

export default function OnboardingStepProgress({ currentStep }: OnboardingStepProgressProps) {
  const currentIndex = ONBOARDING_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between gap-2">
        {ONBOARDING_STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = step.id === currentStep;
          return (
            <div key={step.id} className="flex flex-1 flex-col items-center gap-2">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  done
                    ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                    : active
                      ? "bg-blue-500/20 text-blue-200 ring-2 ring-blue-500/50"
                      : "bg-white/[0.04] text-slate-500 ring-1 ring-white/10"
                }`}
                aria-current={active ? "step" : undefined}
              >
                {done ? "✓" : index + 1}
              </div>
              <span
                className={`hidden text-center text-[10px] font-medium sm:block ${
                  active ? "text-white" : "text-slate-500"
                }`}
              >
                {step.title}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / ONBOARDING_STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
