"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTodaysResumeCount } from "@/hooks/useTodaysResumeCount";

const TABS = [
  { href: "/resume", label: "New resume", isActive: (path: string) => path === "/resume" },
  {
    href: "/resume/discover",
    label: "Job discovery",
    isActive: (path: string) =>
      path === "/resume/discover" || path.startsWith("/resume/discover/"),
  },
  {
    href: "/resume/saved",
    label: "Saved resumes",
    isActive: (path: string) => path === "/resume/saved" || path.startsWith("/resume/saved/"),
  },
] as const;

export default function ResumePanelTabs() {
  const pathname = usePathname();
  const { count, loading } = useTodaysResumeCount(true);
  const displayCount = loading && count == null ? null : count ?? 0;

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-[70vw] flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
      <nav
        className="inline-flex w-full max-w-md rounded-xl border border-slate-200/80 bg-white/90 p-1 shadow-lg shadow-slate-200/40 backdrop-blur-sm dark:border-white/[0.10] dark:bg-navy-900/90 dark:shadow-black/30 sm:w-auto"
        aria-label="Resume sections"
        role="tablist"
      >
        {TABS.map((tab) => {
          const active = tab.isActive(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              role="tab"
              aria-selected={active}
              className={`flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-all sm:flex-none sm:px-6 ${
                active
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div
        className="inline-flex items-center gap-2 self-start rounded-xl border border-blue-500/25 bg-blue-500/[0.08] px-3.5 py-2 text-sm font-semibold text-blue-800 shadow-sm dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-100 sm:self-auto"
        role="status"
        aria-live="polite"
        title="Resumes you saved today (your local time)"
      >
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-blue-600 px-1.5 text-xs font-bold text-white tabular-nums">
          {displayCount == null ? "…" : displayCount}
        </span>
        <span>
          {displayCount == null
            ? "loading today's count…"
            : displayCount === 1
              ? "resume made today"
              : "resumes made today"}
        </span>
      </div>
    </div>
  );
}
