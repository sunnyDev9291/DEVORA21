"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SuperAdminGate } from "@/components/super-admin/SuperAdminGate";
import { saMono } from "@/components/super-admin/resume-dashboard-styles";
import { AUTH_LINKS } from "@/lib/constants";

function RedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams();
    const userId = searchParams.get("userId")?.trim();
    const q = searchParams.get("q")?.trim();
    const date = searchParams.get("date")?.trim();
    if (userId) params.set("userId", userId);
    if (date) params.set("date", date);
    // Legacy `q` is unused in the three-panel UI; keep userId/date only.
    void q;
    const query = params.toString();
    router.replace(
      `${AUTH_LINKS.superAdmin}/application-qa${query ? `?${query}` : ""}`
    );
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className={`${saMono} text-xs text-slate-500`}>Opening Application Q&amp;A…</p>
    </div>
  );
}

/** Legacy list route — redirects into the three-panel workspace. */
export default function SuperAdminApplicationQaSessionsRedirectPage() {
  return (
    <SuperAdminGate>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center">
            <p className={`${saMono} text-xs text-slate-500`}>Opening Application Q&amp;A…</p>
          </div>
        }
      >
        <RedirectInner />
      </Suspense>
    </SuperAdminGate>
  );
}
