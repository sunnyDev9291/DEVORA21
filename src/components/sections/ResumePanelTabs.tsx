"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/resume", label: "New resume", isActive: (path: string) => path === "/resume" },
  {
    href: "/resume/saved",
    label: "Saved resumes",
    isActive: (path: string) => path === "/resume/saved" || path.startsWith("/resume/saved/"),
  },
] as const;

export default function ResumePanelTabs() {
  const pathname = usePathname();

  return (
    <div className="relative z-10 mx-auto w-full max-w-[70vw] px-4 sm:px-6 lg:px-8">
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
    </div>
  );
}
