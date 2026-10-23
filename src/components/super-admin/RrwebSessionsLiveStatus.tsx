"use client";

import type { RrwebSessionsLiveStatus } from "@/hooks/useRrwebSessionsLive";

const LABELS: Record<RrwebSessionsLiveStatus, string> = {
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting",
  offline: "Offline",
};

export default function RrwebSessionsLiveStatusBadge({
  status,
}: {
  status: RrwebSessionsLiveStatus;
}) {
  return (
    <span className="sa-live-status" data-state={status} title="rrweb sessions live stream">
      <span className="sa-live-dot" aria-hidden />
      {LABELS[status]}
    </span>
  );
}
