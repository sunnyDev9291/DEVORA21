"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ApplicationCapturesLiveStatusBadge from "@/components/super-admin/ApplicationCapturesLiveStatus";
import SuperAdminApplicationCapturesWorkspace from "@/components/super-admin/SuperAdminApplicationCapturesWorkspace";
import { SuperAdminGate } from "@/components/super-admin/SuperAdminGate";
import SuperAdminHeader from "@/components/super-admin/SuperAdminHeader";
import { saMono, saPage } from "@/components/super-admin/resume-dashboard-styles";
import type { ApplicationCapturesLiveStatus } from "@/hooks/useApplicationCapturesLive";
import { AUTH_LINKS } from "@/lib/constants";

function ApplicationCapturesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId")?.trim() || "";
  const date = searchParams.get("date")?.trim() || "";
  const sessionId = searchParams.get("sessionId")?.trim() || "";
  const timezone = searchParams.get("timezone")?.trim() || "";
  const [liveStatus, setLiveStatus] = useState<ApplicationCapturesLiveStatus>("connecting");

  const onLiveStatusChange = useCallback((status: ApplicationCapturesLiveStatus) => {
    setLiveStatus(status);
  }, []);

  return (
    <div className={`${saPage} max-w-[96rem]`}>
      <SuperAdminHeader
        title="Application Captures"
        subtitle="Live profile → date → capture session → screenshot slices. Updates stream in as the Capture extension uploads."
        onLock={() => router.replace(AUTH_LINKS.superAdmin)}
        aside={<ApplicationCapturesLiveStatusBadge status={liveStatus} />}
      />
      <SuperAdminApplicationCapturesWorkspace
        initialUserId={userId}
        initialDate={date}
        initialSessionId={sessionId}
        initialTimezone={timezone}
        onLiveStatusChange={onLiveStatusChange}
      />
    </div>
  );
}

export default function SuperAdminApplicationCapturesPage() {
  return (
    <SuperAdminGate>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center">
            <p className={`${saMono} text-xs text-slate-500`}>Loading Application Captures…</p>
          </div>
        }
      >
        <ApplicationCapturesInner />
      </Suspense>
    </SuperAdminGate>
  );
}
