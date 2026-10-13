"use client";

import { useRouter } from "next/navigation";
import { SuperAdminGate } from "@/components/super-admin/SuperAdminGate";
import SuperAdminHeader from "@/components/super-admin/SuperAdminHeader";
import SuperAdminProfilesList from "@/components/super-admin/SuperAdminProfilesList";
import { saPage } from "@/components/super-admin/resume-dashboard-styles";
import { AUTH_LINKS } from "@/lib/constants";

export default function SuperAdminProfilesPage() {
  const router = useRouter();

  return (
    <SuperAdminGate>
      <div className={`${saPage} max-w-7xl`}>
        <SuperAdminHeader
          title="Profiles"
          subtitle="Select a profile on the left to view and edit identity, crawl URLs, template, prompt, and resume-builder access."
          onLock={() => router.replace(AUTH_LINKS.superAdmin)}
        />
        <SuperAdminProfilesList />
      </div>
    </SuperAdminGate>
  );
}
