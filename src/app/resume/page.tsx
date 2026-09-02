import dynamic from "next/dynamic";
import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

const ResumeBuilder = dynamic(() => import("@/components/sections/ResumeBuilder"), {
  loading: () => (
    <div className="bg-gradient-to-b from-warm-50 via-orange-50/50 to-amber-50/30 dark:from-warm-950 dark:via-warm-950 dark:to-warm-900 py-12 sm:py-16" aria-busy="true" aria-label="Loading resume builder">
      <div className="mx-auto w-full max-w-[70vw] px-4 sm:px-6 lg:px-8 animate-pulse">
        <div className="rounded-3xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-warm-900 overflow-hidden">
          <div className="h-24 border-b border-slate-200/80 dark:border-white/[0.06] bg-slate-100 dark:bg-white/[0.03]" />
          <div className="p-8 space-y-4">
            <div className="h-10 rounded-xl bg-slate-200 dark:bg-white/10 w-2/3" />
            <div className="h-32 rounded-xl bg-slate-200 dark:bg-white/10" />
            <div className="h-12 rounded-xl bg-blue-200 dark:bg-blue-500/20 w-48" />
          </div>
        </div>
      </div>
    </div>
  ),
});

export const metadata: Metadata = pageMetadata({
  title: "New Resume",
  description:
    "Generate ATS-optimized resume content tailored to any job. Choose a template, enter a job title and description, preview and download your updated resume.",
  path: "/resume",
});

export default function ResumePage() {
  return <ResumeBuilder />;
}
