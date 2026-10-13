"use client";

import { useParams, useRouter } from "next/navigation";
import { SuperAdminGate } from "@/components/super-admin/SuperAdminGate";
import SuperAdminHeader from "@/components/super-admin/SuperAdminHeader";
import SuperAdminProfileEditor from "@/components/super-admin/SuperAdminProfileEditor";
import { AUTH_LINKS } from "@/lib/constants";

export default function SuperAdminProfileDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = String(params.userId ?? "").trim();

  return (
    <SuperAdminGate>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <SuperAdminHeader
          title="Edit profile"
          subtitle="Changes write to that user’s stored profile (same fields as dashboard + resume builder flag)."
          onLock={() => router.replace(AUTH_LINKS.superAdmin)}
        />
        {userId ? (
          <SuperAdminProfileEditor userId={userId} />
        ) : (
          <p className="mt-8 font-[family-name:var(--font-sa-mono)] text-xs text-red-300">
            Missing user id.
          </p>
        )}
      </div>
    </SuperAdminGate>
  );
}
