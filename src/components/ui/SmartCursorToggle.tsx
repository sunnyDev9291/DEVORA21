"use client";

import { useEffect, useState } from "react";
import {
  readSmartCursorEnabled,
  SMART_CURSOR_CHANGE_EVENT,
  toggleSmartCursorEnabled,
} from "@/lib/smart-cursor-preference";

function supportsFinePointer() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(any-pointer: fine)").matches;
}

export default function SmartCursorToggle({ overlay = false }: { overlay?: boolean }) {
  const [enabled, setEnabled] = useState(true);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    setAvailable(supportsFinePointer());
    setEnabled(readSmartCursorEnabled());

    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      if (typeof detail?.enabled === "boolean") {
        setEnabled(detail.enabled);
      } else {
        setEnabled(readSmartCursorEnabled());
      }
    };

    window.addEventListener(SMART_CURSOR_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(SMART_CURSOR_CHANGE_EVENT, onChange);
  }, []);

  if (!available) return null;

  return (
    <button
      type="button"
      onClick={() => setEnabled(toggleSmartCursorEnabled())}
      aria-pressed={enabled}
      aria-label={enabled ? "Turn off mouse trail effect" : "Turn on mouse trail effect"}
      title={enabled ? "Mouse effect on" : "Mouse effect off"}
      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 ${
        overlay
          ? "text-stone-100 hover:text-white bg-white/10 hover:bg-white/15 border border-white/15 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
          : "text-stone-700 dark:text-stone-200 hover:text-stone-900 dark:hover:text-white bg-stone-100 dark:bg-white/[0.06] hover:bg-stone-200 dark:hover:bg-white/[0.10] border border-stone-200 dark:border-white/[0.08]"
      }`}
    >
      {enabled ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6l8 14 2.5-7.5L22 10 4 6z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 14c1.5 1 3 2.2 4.5 4"
            opacity={0.55}
          />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6l8 14 2.5-7.5L22 10 4 6z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5l14 14" />
        </svg>
      )}
    </button>
  );
}
