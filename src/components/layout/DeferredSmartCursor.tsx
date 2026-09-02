"use client";

import dynamic from "next/dynamic";

const SmartCursor = dynamic(() => import("@/components/ui/SmartCursor"), { ssr: false });

export default function DeferredSmartCursor() {
  return <SmartCursor />;
}
