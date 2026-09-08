import dynamic from "next/dynamic";
import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

const SavedResumesPanel = dynamic(
  () => import("@/components/dashboard/SavedResumesPanel"),
  {
    loading: () => (
      <div className="bg-transparent py-12 sm:py-16" aria-busy="true" aria-label="Loading saved resumes">
        <div className="mx-auto w-full max-w-[70vw] px-4 sm:px-6 lg:px-8 animate-pulse">
          <div className="rounded-3xl border border-orange-200/50 bg-gloss-warm p-8 dark:border-orange-500/15 dark:bg-gloss-warm-dark">
            <div className="mb-6 h-8 w-1/3 rounded-lg bg-orange-200/50 dark:bg-white/10" />
            <div className="h-64 rounded-xl bg-orange-100/60 dark:bg-white/10" />
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
    <section className="relative overflow-hidden bg-transparent py-10 sm:py-14">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 top-0 h-[380px] w-[820px] -translate-x-1/2 rounded-full bg-orange-400/12 blur-[110px]" />
        <div className="absolute bottom-0 right-0 h-[280px] w-[460px] rounded-full bg-sun-400/10 blur-[100px]" />
      </div>
      <div className="relative mx-auto w-full max-w-[70vw] px-4 sm:px-6 lg:px-8">
        <SavedResumesPanel variant="resume" />
      </div>
    </section>
  );
}
