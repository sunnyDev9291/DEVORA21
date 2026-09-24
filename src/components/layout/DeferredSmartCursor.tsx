"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  readSmartCursorEnabled,
  SMART_CURSOR_CHANGE_EVENT,
} from "@/lib/smart-cursor-preference";

const SmartCursor = dynamic(() => import("@/components/ui/SmartCursor"), { ssr: false });

/** Load custom cursor after idle so it never blocks first paint / hydration. */
export default function DeferredSmartCursor() {
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
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

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idleId: number | undefined;

    const load = () => {
      if (!cancelled) setReady(true);
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(load, { timeout: 5000 });
    } else if (typeof window !== "undefined") {
      timer = setTimeout(load, 3000);
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);

  if (!ready || !enabled) return null;
  return <SmartCursor />;
}
