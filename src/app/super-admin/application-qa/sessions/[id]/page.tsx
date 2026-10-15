"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { SuperAdminGate } from "@/components/super-admin/SuperAdminGate";
import { saMono } from "@/components/super-admin/resume-dashboard-styles";
import { AUTH_LINKS } from "@/lib/constants";

/** Legacy detail route — redirects into the three-panel workspace with sessionId. */
export default function SuperAdminApplicationQaSessionDetailRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const rawId = params?.id;
  const sessionId = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : "";

  useEffect(() => {
    const paramsQs = new URLSearchParams();
    if (sessionId) paramsQs.set("sessionId", sessionId);
    const query = paramsQs.toString();
    router.replace(
      `${AUTH_LINKS.superAdmin}/application-qa${query ? `?${query}` : ""}`
    );
  }, [router, sessionId]);

  return (
    <SuperAdminGate>
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className={`${saMono} text-xs text-slate-500`}>Opening session…</p>
      </div>
    </SuperAdminGate>
  );
}
