"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SuperAdminApplicationCapturesGallery from "@/components/super-admin/SuperAdminApplicationCapturesGallery";
import { SuperAdminGate } from "@/components/super-admin/SuperAdminGate";
import SuperAdminHeader from "@/components/super-admin/SuperAdminHeader";
import { saMono, saPage } from "@/components/super-admin/resume-dashboard-styles";
import { AUTH_LINKS } from "@/lib/constants";

function ApplicationCapturesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId")?.trim() || "";
  const q = searchParams.get("q")?.trim() || "";

  return (
    <div className={`${saPage} max-w-[96rem]`}>
      <SuperAdminHeader
        title="Application Captures"
        subtitle="Browse grayscale screenshot sessions auto-uploaded by the Capture extension after Submit on apply pages. Filter by owner or search — refresh manually."
        onLock={() => router.replace(AUTH_LINKS.superAdmin)}
      />
      <SuperAdminApplicationCapturesGallery initialUserId={userId} initialQ={q} />
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
