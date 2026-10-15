"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import SuperAdminApplicationQaSessions from "@/components/super-admin/SuperAdminApplicationQaSessions";
import { SuperAdminGate } from "@/components/super-admin/SuperAdminGate";
import SuperAdminHeader from "@/components/super-admin/SuperAdminHeader";
import { saMono, saPage } from "@/components/super-admin/resume-dashboard-styles";
import { AUTH_LINKS } from "@/lib/constants";

function SessionsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId")?.trim() || "";
  const q = searchParams.get("q")?.trim() || "";

  return (
    <div className={`${saPage} max-w-[90rem]`}>
      <SuperAdminHeader
        title="Q&A sessions"
        subtitle="Filter by extension owner or search URL, page title, and owner email."
        onLock={() => router.replace(AUTH_LINKS.superAdmin)}
      />
      <SuperAdminApplicationQaSessions initialUserId={userId} initialQ={q} />
    </div>
  );
}

export default function SuperAdminApplicationQaSessionsPage() {
  return (
    <SuperAdminGate>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center">
            <p className={`${saMono} text-xs text-slate-500`}>Loading sessions…</p>
          </div>
        }
      >
        <SessionsInner />
      </Suspense>
    </SuperAdminGate>
  );
}
