"use client";

import { useRouter } from "next/navigation";
import { SuperAdminGate } from "@/components/super-admin/SuperAdminGate";
import SuperAdminHeader from "@/components/super-admin/SuperAdminHeader";
import SuperAdminProfilesList from "@/components/super-admin/SuperAdminProfilesList";
import { AUTH_LINKS } from "@/lib/constants";

export default function SuperAdminProfilesPage() {
  const router = useRouter();

  return (
    <SuperAdminGate>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <SuperAdminHeader
          title="Profiles"
          subtitle="List every account, open a profile, and edit name, assets, crawl URLs, and resume-builder access."
          onLock={() => router.replace(AUTH_LINKS.superAdmin)}
        />
        <SuperAdminProfilesList />
      </div>
    </SuperAdminGate>
  );
}
