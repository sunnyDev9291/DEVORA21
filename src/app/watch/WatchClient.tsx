"use client";

import dynamic from "next/dynamic";

const SmartWatch = dynamic(() => import("@/components/smartwatch/SmartWatch"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-[#f5f0e6]">
      <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
    </div>
  ),
});

export default function WatchClient() {
  return <SmartWatch />;
}
