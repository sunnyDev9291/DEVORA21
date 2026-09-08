"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const SmartCursor = dynamic(() => import("@/components/ui/SmartCursor"), { ssr: false });

/** Load custom cursor after idle so it never blocks first paint / hydration. */
export default function DeferredSmartCursor() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idleId: number | undefined;

    const load = () => {
      if (!cancelled) setShow(true);
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

  if (!show) return null;
  return <SmartCursor />;
}
