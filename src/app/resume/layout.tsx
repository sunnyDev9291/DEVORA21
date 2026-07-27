import PageHero from "@/components/layout/PageHero";
import RequireResumeBuilder from "@/components/auth/RequireResumeBuilder";
import { ResumeApplyTypeProvider } from "@/components/sections/ResumeApplyTypeContext";
import ResumePanelTabs from "@/components/sections/ResumePanelTabs";
import type { ReactNode } from "react";

export default function ResumeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHero
        title="Resume"
        description="Build a new tailored resume for each application, or browse and download resumes you already saved."
      />
      <RequireResumeBuilder>
        <ResumeApplyTypeProvider>
          <div className="-mt-4 mb-8 sm:-mt-6">
            <ResumePanelTabs />
          </div>
          {children}
        </ResumeApplyTypeProvider>
      </RequireResumeBuilder>
    </>
  );
}
