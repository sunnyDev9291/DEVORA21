"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import ApplicationQaLiveStatusBadge from "@/components/super-admin/ApplicationQaLiveStatus";
import SuperAdminApplicationQaWorkspace from "@/components/super-admin/SuperAdminApplicationQaWorkspace";
import { SuperAdminGate } from "@/components/super-admin/SuperAdminGate";
import SuperAdminHeader from "@/components/super-admin/SuperAdminHeader";
import { saMono, saPage } from "@/components/super-admin/resume-dashboard-styles";
import type { ApplicationQaLiveStatus } from "@/hooks/useApplicationQaLive";
import { AUTH_LINKS } from "@/lib/constants";

function ApplicationQaInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId")?.trim() || "";
  const date = searchParams.get("date")?.trim() || "";
  const sessionId = searchParams.get("sessionId")?.trim() || "";
  const [liveStatus, setLiveStatus] = useState<ApplicationQaLiveStatus>("connecting");

  const onLiveStatusChange = useCallback((status: ApplicationQaLiveStatus) => {
    setLiveStatus(status);
  }, []);

  return (
    <div className={`${saPage} max-w-[96rem]`}>
      <SuperAdminHeader
        title="Application Q&A"
        subtitle="Live Profile → date → Apply Page session → DOM input events. Updates stream in as the Chrome extension records."
        onLock={() => router.replace(AUTH_LINKS.superAdmin)}
        aside={<ApplicationQaLiveStatusBadge status={liveStatus} />}
      />
      <SuperAdminApplicationQaWorkspace
        initialUserId={userId}
        initialDate={date}
        initialSessionId={sessionId}
        onLiveStatusChange={onLiveStatusChange}
      />
    </div>
  );
}

export default function SuperAdminApplicationQaPage() {
  return (
    <SuperAdminGate>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center">
            <p className={`${saMono} text-xs text-slate-500`}>Loading Application Q&amp;A…</p>
          </div>
        }
      >
        <ApplicationQaInner />
      </Suspense>
    </SuperAdminGate>
  );
}
