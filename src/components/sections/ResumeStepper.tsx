"use client";

const STEPS = [
  { id: 1, label: "Template", short: "Pick a .docx" },
  { id: 2, label: "Job details", short: "Target role" },
  { id: 3, label: "Edit draft", short: "Review & tweak" },
  { id: 4, label: "Download", short: "Get your file" },
] as const;

interface ResumeStepperProps {
  currentStep: number;
}

export default function ResumeStepper({ currentStep }: ResumeStepperProps) {
  return (
    <nav aria-label="Resume builder progress" className="mb-10">
      <ol className="flex items-center justify-between gap-2 list-none m-0 p-0">
        {STEPS.map((step, index) => {
          const done = currentStep > step.id;
          const active = currentStep === step.id;

          return (
            <li key={step.id} className="flex items-center flex-1 min-w-0 last:flex-none">
              <div className="flex flex-col items-center text-center w-full min-w-0">
                <div
                  className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 text-sm font-bold transition-all duration-300 ${
                    done
                      ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-orange-500/30"
                      : active
                        ? "bg-orange-500/15 border-orange-500 text-orange-600 dark:text-orange-300 ring-4 ring-blue-500/10"
                        : "bg-slate-100 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-400"
                  }`}
                >
                  {done ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.id
                  )}
                </div>
                <p
                  className={`mt-2 text-xs sm:text-sm font-semibold truncate w-full px-1 ${
                    active ? "text-slate-900 dark:text-white" : done ? "text-slate-600 dark:text-slate-300" : "text-slate-400"
                  }`}
                >
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.short}</span>
                </p>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`hidden sm:block h-0.5 flex-1 mx-2 rounded-full transition-colors duration-300 ${
                    done ? "bg-blue-500" : "bg-slate-200 dark:bg-white/[0.08]"
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function resolveResumeWizardStep({
  hasTemplate,
  generating,
  hasDraft,
  isDone,
}: {
  hasTemplate: boolean;
  generating: boolean;
  hasDraft: boolean;
  isDone: boolean;
}): number {
  if (isDone) return 4;
  if (hasDraft && !generating) return 3;
  if (generating || (hasTemplate && !hasDraft)) return 2;
  if (hasTemplate) return 2;
  return 1;
}
