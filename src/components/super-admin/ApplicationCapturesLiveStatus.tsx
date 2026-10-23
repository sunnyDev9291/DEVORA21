"use client";

import type { ApplicationCapturesLiveStatus } from "@/hooks/useApplicationCapturesLive";

const LABELS: Record<ApplicationCapturesLiveStatus, string> = {
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting",
  offline: "Offline",
};

export default function ApplicationCapturesLiveStatusBadge({
  status,
}: {
  status: ApplicationCapturesLiveStatus;
}) {
  return (
    <span className="sa-live-status" data-state={status} title="Application Captures live stream">
      <span className="sa-live-dot" aria-hidden />
      {LABELS[status]}
    </span>
  );
}
