"use client";

import { useParams, useRouter } from "next/navigation";
import SuperAdminApplicationQaDetail from "@/components/super-admin/SuperAdminApplicationQaDetail";
import { SuperAdminGate } from "@/components/super-admin/SuperAdminGate";
import SuperAdminHeader from "@/components/super-admin/SuperAdminHeader";
import { saMono, saPage } from "@/components/super-admin/resume-dashboard-styles";
import { AUTH_LINKS } from "@/lib/constants";

export default function SuperAdminApplicationQaSessionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const rawId = params?.id;
  const sessionId = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : "";

  return (
    <SuperAdminGate>
      <div className={`${saPage} max-w-[90rem]`}>
        <SuperAdminHeader
          title="Session detail"
          subtitle="Owner, tab context, and every captured question/answer with timestamps."
          onLock={() => router.replace(AUTH_LINKS.superAdmin)}
        />
        {sessionId ? (
          <SuperAdminApplicationQaDetail sessionId={sessionId} />
        ) : (
          <p className={`${saMono} mt-8 text-xs text-slate-500`}>Missing session id.</p>
        )}
      </div>
    </SuperAdminGate>
  );
}
