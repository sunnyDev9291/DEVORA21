"use client";

import { useEffect, useState } from "react";
import TemplatePicker from "@/components/sections/TemplatePicker";
import ResumeGenerator from "@/components/sections/ResumeGenerator";
import ResumeStepper from "@/components/sections/ResumeStepper";
import { useAuth } from "@/context/AuthContext";
import type { ResumeTemplate } from "@/lib/resume-template";
import { LEGACY_TEMPLATE_STORAGE_KEY, loadStoredProfile, saveStoredProfile } from "@/lib/user-profile";

export default function ResumeBuilder() {
  const { user } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState<ResumeTemplate | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      try {
        const saved = sessionStorage.getItem(LEGACY_TEMPLATE_STORAGE_KEY);
        if (saved) setSelectedTemplate(JSON.parse(saved) as ResumeTemplate);
      } catch {
        // ignore
      }
      setPrefsLoaded(true);
      return;
    }

    const prefs = loadStoredProfile(user.id);
    if (prefs.resumeTemplate) {
      setSelectedTemplate(prefs.resumeTemplate);
    }
    setPrefsLoaded(true);
  }, [user?.id]);

  function handleSelect(template: ResumeTemplate) {
    setSelectedTemplate(template);
    if (user?.id) {
      saveStoredProfile(user.id, { resumeTemplate: template });
    } else {
      sessionStorage.setItem(LEGACY_TEMPLATE_STORAGE_KEY, JSON.stringify(template));
    }
  }

  return (
    <section className="relative bg-slate-50 dark:bg-navy-950 py-12 sm:py-16 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[420px] bg-blue-600/8 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-violet-600/6 blur-[100px] rounded-full" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <ResumeStepper currentStep={wizardStep} />

        <div className="rounded-3xl border border-slate-200/80 dark:border-white/[0.08] bg-white/90 dark:bg-navy-900/80 backdrop-blur-sm shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden">
          <div className="px-6 sm:px-8 py-6 sm:py-7 border-b border-slate-200/80 dark:border-white/[0.06] bg-gradient-to-r from-slate-50/80 to-blue-50/30 dark:from-white/[0.02] dark:to-blue-500/[0.04]">
            <TemplatePicker selected={selectedTemplate} onSelect={handleSelect} />
          </div>

          <div className="px-6 sm:px-8 py-8 sm:py-10">
            {prefsLoaded && (
              <ResumeGenerator selectedTemplate={selectedTemplate} onWizardStepChange={setWizardStep} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
