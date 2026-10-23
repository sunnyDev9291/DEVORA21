"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RrwebSessionsLiveStatusBadge from "@/components/super-admin/RrwebSessionsLiveStatus";
import SuperAdminRrwebSessionsWorkspace from "@/components/super-admin/SuperAdminRrwebSessionsWorkspace";
import { SuperAdminGate } from "@/components/super-admin/SuperAdminGate";
import SuperAdminHeader from "@/components/super-admin/SuperAdminHeader";
import { saMono, saPage } from "@/components/super-admin/resume-dashboard-styles";
import type { RrwebSessionsLiveStatus } from "@/hooks/useRrwebSessionsLive";
import { AUTH_LINKS } from "@/lib/constants";

function RrwebSessionsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId")?.trim() || "";
  const date = searchParams.get("date")?.trim() || "";
  const sessionId = searchParams.get("sessionId")?.trim() || "";
  const timezone = searchParams.get("timezone")?.trim() || "";
  const [liveStatus, setLiveStatus] = useState<RrwebSessionsLiveStatus>("connecting");

  const onLiveStatusChange = useCallback((status: RrwebSessionsLiveStatus) => {
    setLiveStatus(status);
  }, []);

  return (
    <div className={`${saPage} max-w-[96rem]`}>
      <SuperAdminHeader
        title="Session Replay"
        subtitle="Live profile → date → apply attempt → rrweb DOM replay (including iframes when recorded). Sensitive PII — passwords masked at record time."
        onLock={() => router.replace(AUTH_LINKS.superAdmin)}
        aside={<RrwebSessionsLiveStatusBadge status={liveStatus} />}
      />
      <SuperAdminRrwebSessionsWorkspace
        initialUserId={userId}
        initialDate={date}
        initialSessionId={sessionId}
        initialTimezone={timezone}
        onLiveStatusChange={onLiveStatusChange}
      />
    </div>
  );
}

export default function SuperAdminRrwebSessionsPage() {
  return (
    <SuperAdminGate>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center">
            <p className={`${saMono} text-xs text-slate-500`}>Loading Session Replay…</p>
          </div>
        }
      >
        <RrwebSessionsInner />
      </Suspense>
    </SuperAdminGate>
  );
}
