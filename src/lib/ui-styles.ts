/** Shared Tailwind class strings for consistent UI across the app. */

export const ui = {
  page: "min-h-[calc(100vh-5rem)] bg-slate-50 dark:bg-navy-950",
  pageSection: "relative overflow-hidden bg-slate-50 py-12 dark:bg-navy-950 sm:py-16",

  card:
    "overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-xl shadow-slate-300/25 backdrop-blur-sm dark:border-white/[0.08] dark:bg-navy-900/90 dark:shadow-black/30 sm:p-8",
  cardCompact:
    "rounded-2xl border border-slate-200/90 bg-white/95 p-6 shadow-lg shadow-slate-300/20 backdrop-blur-sm dark:border-white/[0.08] dark:bg-navy-900/85 dark:shadow-black/25",

  input:
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] leading-snug text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/[0.10] dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500 dark:hover:border-white/[0.16] dark:focus:border-indigo-400/70 dark:focus:ring-indigo-400/20",

  label: "mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300",

  headingLg: "font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white",
  headingMd: "font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white",
  headingSm: "font-display text-base font-semibold tracking-tight text-slate-900 dark:text-white",

  muted: "text-slate-600 dark:text-slate-400",
  mutedSm: "text-sm text-slate-500 dark:text-slate-400",

  brandGradient: "bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600 bg-clip-text text-transparent",
} as const;
