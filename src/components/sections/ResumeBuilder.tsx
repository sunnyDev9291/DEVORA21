"use client";

import Link from "next/link";
import ResumeFromJobPanel from "@/components/sections/ResumeFromJobPanel";
import ResumeGenerator from "@/components/sections/ResumeGenerator";
import ResumeStepper from "@/components/sections/ResumeStepper";
import ResumeTemplatePreviewButton from "@/components/ui/ResumeTemplatePreviewButton";
import { useAuth } from "@/context/AuthContext";
import { useUserProfileAssets } from "@/hooks/useUserProfileAssets";
import { AUTH_LINKS } from "@/lib/constants";
import { ui } from "@/lib/ui-styles";
import { useState } from "react";

export default function ResumeBuilder() {
  const { user } = useAuth();
  const { template, prompt, loading, error } = useUserProfileAssets(user?.id);
  const [wizardStep, setWizardStep] = useState(1);

  return (
    <section className={`relative overflow-x-hidden ${ui.pageSection}`}>
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-indigo-600/8 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[300px] w-[500px] rounded-full bg-violet-600/6 blur-[100px]" />
      </div>

      <div className="relative mx-auto w-full max-w-[70vw] px-4 sm:px-6 lg:px-8">
        <ResumeStepper currentStep={wizardStep} />

        <div className={`overflow-x-hidden ${ui.card} shadow-card dark:shadow-card-dark p-0 sm:p-0`}>
          <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-50/90 to-indigo-50/40 px-6 py-6 dark:border-white/[0.06] dark:from-white/[0.02] dark:to-indigo-500/[0.06] sm:px-8 sm:py-7">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Step 1 · Your template
            </p>
            {loading ? (
              <p className="mt-2 text-sm text-slate-500">Loading your profile template…</p>
            ) : template ? (
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white break-all">{template.fileName}</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    This is your uploaded resume template. Update it from your{" "}
                    <Link href={AUTH_LINKS.dashboard} className="text-blue-500 hover:text-blue-400">
                      dashboard profile
                    </Link>
                    .
                  </p>
                </div>
                <ResumeTemplatePreviewButton
                  fileName={template.fileName}
                  templateBase64={template.templateBase64}
                  className="shrink-0 self-start"
                />
              </div>
            ) : (
              <div className="mt-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">No template uploaded</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Upload a .docx template on your{" "}
                  <Link href={AUTH_LINKS.dashboard} className="text-blue-500 hover:text-blue-400">
                    dashboard profile
                  </Link>{" "}
                  or during onboarding before generating resumes.
                </p>
              </div>
            )}
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          </div>

          <div className="px-6 py-8 sm:px-8 sm:py-10 space-y-10">
            <ResumeFromJobPanel />

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <div className="w-full border-t border-slate-200 dark:border-white/[0.08]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:bg-navy-900 dark:text-slate-500">
                  Or build step-by-step
                </span>
              </div>
            </div>

            {loading && !template && !prompt ? (
              <p className="text-sm text-slate-500">Loading your profile…</p>
            ) : (
              <ResumeGenerator
                userTemplate={template}
                userPrompt={prompt?.content ?? ""}
                onWizardStepChange={setWizardStep}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
