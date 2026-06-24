"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const ChatWidgets = dynamic(() => import("@/components/ui/ChatWidgets"), { ssr: false });

export default function DeferredChatWidgets() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idleId: number | undefined;

    const load = () => {
      if (!cancelled) setShow(true);
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(load, { timeout: 4000 });
    } else if (typeof window !== "undefined") {
      timer = setTimeout(load, 2500);
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
  return <ChatWidgets />;
}
