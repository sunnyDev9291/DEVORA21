"use client";

import { useParams, useRouter } from "next/navigation";
import { SuperAdminGate } from "@/components/super-admin/SuperAdminGate";
import SuperAdminHeader from "@/components/super-admin/SuperAdminHeader";
import SuperAdminProfileEditor from "@/components/super-admin/SuperAdminProfileEditor";
import { saMono, saPage } from "@/components/super-admin/resume-dashboard-styles";
import { AUTH_LINKS } from "@/lib/constants";

export default function SuperAdminProfileDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = String(params.userId ?? "").trim();

  return (
    <SuperAdminGate>
      <div className={`${saPage} max-w-3xl`}>
        <SuperAdminHeader
          title="Edit profile"
          subtitle="Changes write to that user’s stored profile (same fields as dashboard + resume builder flag)."
          onLock={() => router.replace(AUTH_LINKS.superAdmin)}
        />
        {userId ? (
          <SuperAdminProfileEditor userId={userId} />
        ) : (
          <p className={`${saMono} mt-8 text-xs text-red-300`}>Missing user id.</p>
        )}
      </div>
    </SuperAdminGate>
  );
}
