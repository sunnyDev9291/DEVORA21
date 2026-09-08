import PageHero from "@/components/layout/PageHero";
import RequireResumeBuilder from "@/components/auth/RequireResumeBuilder";
import ResumePanelTabs from "@/components/sections/ResumePanelTabs";
import SmartWatchPanel from "@/components/ui/SmartWatchPanel";
import type { ReactNode } from "react";

export default function ResumeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHero
        title="Resume"
        description="Build a new tailored resume for each application, or browse and download resumes you already saved."
      />
      <RequireResumeBuilder>
        <div className="relative z-10 mb-8 mt-6 sm:mt-8">
          <ResumePanelTabs />
        </div>
        {children}
        <SmartWatchPanel />
      </RequireResumeBuilder>
    </>
  );
}
