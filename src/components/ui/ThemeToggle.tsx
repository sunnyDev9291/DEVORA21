"use client";

import { useTheme } from "@/providers/ThemeProvider";

export default function ThemeToggle({ overlay = false }: { overlay?: boolean }) {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 ${
        overlay
          ? "text-stone-100 hover:text-white bg-white/10 hover:bg-white/15 border border-white/15 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
          : "text-stone-500 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white bg-stone-100 dark:bg-white/[0.06] hover:bg-stone-200 dark:hover:bg-white/[0.10] border border-stone-200 dark:border-white/[0.08]"
      }`}
    >
      {theme === "dark" ? (
        // Sun icon (switch to light)
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"
          />
        </svg>
      ) : (
        // Moon icon (switch to dark)
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
}
