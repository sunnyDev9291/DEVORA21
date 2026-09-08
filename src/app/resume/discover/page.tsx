import dynamic from "next/dynamic";
import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

const BuiltInCrawlPanel = dynamic(
  () => import("@/components/sections/BuiltInCrawlPanel"),
  {
    loading: () => (
      <div className="animate-pulse rounded-3xl border border-orange-200/50 bg-gloss-warm p-8 dark:border-orange-500/15 dark:bg-gloss-warm-dark">
        <div className="mb-6 h-8 w-1/3 rounded-lg bg-orange-200/50 dark:bg-white/10" />
        <div className="mb-4 h-12 rounded-xl bg-orange-100/60 dark:bg-white/10" />
        <div className="h-10 w-40 rounded-xl bg-orange-100/60 dark:bg-white/10" />
      </div>
    ),
  }
);

export const metadata: Metadata = pageMetadata({
  title: "Job Discovery",
  description: "Crawl Built In, HiringCafe, or Workable job listings in one merged list.",
  path: "/resume/discover",
});

export default function JobDiscoverPage() {
  return (
    <section className="relative overflow-hidden bg-transparent py-10 sm:py-14">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 top-0 h-[380px] w-[820px] -translate-x-1/2 rounded-full bg-orange-400/12 blur-[110px]" />
        <div className="absolute bottom-0 right-0 h-[280px] w-[460px] rounded-full bg-sun-400/10 blur-[100px]" />
      </div>
      <div className="relative mx-auto w-full max-w-[70vw] px-4 sm:px-6 lg:px-8">
        <BuiltInCrawlPanel />
      </div>
    </section>
  );
}
