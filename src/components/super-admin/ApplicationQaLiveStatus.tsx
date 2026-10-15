"use client";

import type { ApplicationQaLiveStatus } from "@/hooks/useApplicationQaLive";

const LABELS: Record<ApplicationQaLiveStatus, string> = {
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting",
  offline: "Offline",
};

export default function ApplicationQaLiveStatusBadge({
  status,
}: {
  status: ApplicationQaLiveStatus;
}) {
  return (
    <span className="sa-live-status" data-state={status} title="Application Q&A live stream">
      <span className="sa-live-dot" aria-hidden />
      {LABELS[status]}
    </span>
  );
}
