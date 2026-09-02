"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { brand, ui } from "@/lib/ui-styles";

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

type SliderRect = {
  left: number;
  width: number;
};

export default function ResumePanelTabs() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [slider, setSlider] = useState<SliderRect | null>(null);
  const [sliderReady, setSliderReady] = useState(false);

  const activeIndex = TABS.findIndex((tab) => tab.isActive(pathname));

  const updateSlider = useCallback(() => {
    if (activeIndex < 0) return;

    const tabEl = tabRefs.current[activeIndex];
    const navEl = navRef.current;
    if (!tabEl || !navEl) return;

    const navRect = navEl.getBoundingClientRect();
    const tabRect = tabEl.getBoundingClientRect();

    setSlider({
      left: tabRect.left - navRect.left,
      width: tabRect.width,
    });
    setSliderReady(true);
  }, [activeIndex]);

  useLayoutEffect(() => {
    updateSlider();
  }, [updateSlider, pathname]);

  useEffect(() => {
    window.addEventListener("resize", updateSlider);
    return () => window.removeEventListener("resize", updateSlider);
  }, [updateSlider]);

  useEffect(() => {
    if (typeof document === "undefined" || !("fonts" in document)) return;
    void document.fonts.ready.then(updateSlider);
  }, [updateSlider]);

  return (
    <div className="relative z-10 mx-auto w-full max-w-[70vw] px-4 sm:px-6 lg:px-8">
      <nav
        ref={navRef}
        className={ui.tabBar}
        aria-label="Resume sections"
        role="tablist"
      >
        {slider ? (
          <span
            aria-hidden
            className={`pointer-events-none absolute top-1 bottom-1 rounded-lg ${brand.gradientPill} transition-[left,width,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              sliderReady ? "opacity-100" : "opacity-0"
            }`}
            style={{ left: slider.left, width: slider.width }}
          />
        ) : null}

        {TABS.map((tab, index) => {
          const active = tab.isActive(pathname);

          return (
            <Link
              key={tab.href}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              href={tab.href}
              role="tab"
              aria-selected={active}
              className={`relative z-10 flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors duration-500 sm:flex-none sm:px-6 ${
                active
                  ? "text-white"
                  : "text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-50"
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
