"use client";

import { useEffect, useState } from "react";
import TemplatePicker from "@/components/sections/TemplatePicker";
import ResumeGenerator from "@/components/sections/ResumeGenerator";
import type { ResumeTemplate } from "@/lib/resume-template";

const STORAGE_KEY = "devora21-selected-resume-template";

export default function ResumeBuilder() {
  const [selectedTemplate, setSelectedTemplate] = useState<ResumeTemplate | null>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setSelectedTemplate(JSON.parse(saved) as ResumeTemplate);
    } catch {
      // ignore invalid stored value
    }
  }, []);

  function handleSelect(template: ResumeTemplate) {
    setSelectedTemplate(template);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(template));
  }

  return (
    <>
      <section className="bg-slate-50 dark:bg-navy-950 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <TemplatePicker selected={selectedTemplate} onSelect={handleSelect} />
        </div>
      </section>

      <section className="bg-white dark:bg-navy-900 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ResumeGenerator selectedTemplate={selectedTemplate} />
        </div>
      </section>
    </>
  );
}
