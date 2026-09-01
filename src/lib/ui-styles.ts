/** Shared Tailwind class strings for consistent warm UI across the app. */

export const brand = {
  gradientText:
    "bg-gradient-to-r from-tomato-600 via-orange-500 to-sun-400 bg-clip-text text-transparent dark:from-tomato-400 dark:via-orange-400 dark:to-sun-300",
  gradientPill:
    "bg-gradient-to-r from-tomato-600 via-orange-500 to-sun-400 shadow-lg shadow-orange-500/25",
  gradientPillHover:
    "hover:from-tomato-500 hover:via-orange-400 hover:to-sun-300 hover:shadow-orange-400/35",
  gradientButton:
    "bg-gradient-to-r from-tomato-600 via-orange-500 to-sun-400 hover:from-tomato-500 hover:via-orange-400 hover:to-sun-300 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-400/35",
  focusRing:
    "focus:border-orange-500 focus:ring-2 focus:ring-orange-500/25 dark:focus:border-orange-400/70 dark:focus:ring-orange-400/20",
  link: "text-orange-700 hover:text-tomato-600 dark:text-orange-400 dark:hover:text-orange-300",
} as const;

export const ui = {
  page: "min-h-[calc(100vh-5rem)] bg-gradient-to-b from-warm-50 via-orange-50/50 to-amber-50/30 dark:from-warm-950 dark:via-warm-950 dark:to-warm-900",
  pageSection:
    "relative overflow-hidden bg-gradient-to-b from-warm-50 via-orange-50/50 to-amber-50/30 py-12 dark:from-warm-950 dark:via-warm-950 dark:to-warm-900 sm:py-16",

  card:
    "overflow-hidden rounded-3xl border border-orange-200/60 bg-gloss-warm p-6 shadow-gloss backdrop-blur-md dark:border-orange-500/12 dark:bg-gloss-warm-dark dark:shadow-card-dark sm:p-8",
  cardCompact:
    "rounded-2xl border border-orange-200/60 bg-gloss-warm p-6 shadow-card backdrop-blur-md dark:border-orange-500/12 dark:bg-gloss-warm-dark dark:shadow-card-dark",

  tabBar:
    "relative inline-flex w-full max-w-md rounded-xl border border-orange-200/70 bg-white/85 p-1 shadow-gloss backdrop-blur-md dark:border-orange-500/15 dark:bg-warm-900/90 dark:shadow-card-dark sm:w-auto",

  input: `w-full rounded-xl border border-orange-200/80 bg-white/90 px-4 py-3 text-[15px] leading-snug text-stone-900 shadow-sm outline-none transition-all placeholder:text-stone-400 hover:border-orange-300 ${brand.focusRing} dark:border-orange-500/15 dark:bg-white/[0.05] dark:text-stone-100 dark:placeholder:text-stone-500 dark:hover:border-orange-400/30`,

  label: "mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300",

  headingLg: "font-display text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50",
  headingMd: "font-display text-xl font-bold tracking-tight text-stone-900 dark:text-stone-50",
  headingSm: "font-display text-base font-semibold tracking-tight text-stone-900 dark:text-stone-50",

  muted: "text-stone-600 dark:text-stone-400",
  mutedSm: "text-sm text-stone-500 dark:text-stone-400",

  brandGradient: brand.gradientText,
} as const;
