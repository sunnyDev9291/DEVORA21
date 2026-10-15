"use client";

import { useRouter } from "next/navigation";
import SuperAdminApplicationQaOwners from "@/components/super-admin/SuperAdminApplicationQaOwners";
import { SuperAdminGate } from "@/components/super-admin/SuperAdminGate";
import SuperAdminHeader from "@/components/super-admin/SuperAdminHeader";
import { saPage } from "@/components/super-admin/resume-dashboard-styles";
import { AUTH_LINKS } from "@/lib/constants";

export default function SuperAdminApplicationQaPage() {
  const router = useRouter();

  return (
    <SuperAdminGate>
      <div className={saPage}>
        <SuperAdminHeader
          title="Application Q&A"
          subtitle="Browse Chrome extension recordings by owner — sessions, tab URLs, and captured question/answer pairs."
          onLock={() => router.replace(AUTH_LINKS.superAdmin)}
        />
        <SuperAdminApplicationQaOwners />
      </div>
    </SuperAdminGate>
  );
}
