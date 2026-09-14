"use client";

import dynamic from "next/dynamic";

const SmartWatchPanel = dynamic(() => import("@/components/ui/SmartWatchPanel"), {
  ssr: false,
});

export default function DeferredSmartWatchPanel() {
  return <SmartWatchPanel />;
}
