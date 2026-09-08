import dynamic from "next/dynamic";
import PageHero from "@/components/layout/PageHero";
import RequireResumeBuilder from "@/components/auth/RequireResumeBuilder";
import ResumePanelTabs from "@/components/sections/ResumePanelTabs";
import type { ReactNode } from "react";

const SmartWatchPanel = dynamic(() => import("@/components/ui/SmartWatchPanel"), {
  ssr: false,
});

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
