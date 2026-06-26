import dynamic from "next/dynamic";
import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

const SavedResumesPanel = dynamic(
  () => import("@/components/dashboard/SavedResumesPanel"),
  {
    loading: () => (
      <div className="bg-slate-50 dark:bg-navy-950 py-12 sm:py-16" aria-busy="true" aria-label="Loading saved resumes">
        <div className="mx-auto w-full max-w-[70vw] px-4 sm:px-6 lg:px-8 animate-pulse">
          <div className="rounded-3xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-navy-900 p-8">
            <div className="h-8 rounded-lg bg-slate-200 dark:bg-white/10 w-1/3 mb-6" />
            <div className="h-64 rounded-xl bg-slate-200 dark:bg-white/10" />
          </div>
        </div>
      </div>
    ),
  }
);

export const metadata: Metadata = pageMetadata({
  title: "Saved Resumes",
  description: "Browse, search, preview, and download resumes you saved for past job applications.",
  path: "/resume/saved",
});

export default function SavedResumesPage() {
  return (
    <section className="relative overflow-hidden bg-slate-50 py-12 dark:bg-navy-950 sm:py-16">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-blue-600/8 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[300px] w-[500px] rounded-full bg-violet-600/6 blur-[100px]" />
      </div>
      <div className="relative mx-auto w-full max-w-[70vw] px-4 sm:px-6 lg:px-8">
        <SavedResumesPanel variant="resume" />
      </div>
    </section>
  );
}
