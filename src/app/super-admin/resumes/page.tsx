"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { SuperAdminGate } from "@/components/super-admin/SuperAdminGate";
import SuperAdminHeader from "@/components/super-admin/SuperAdminHeader";
import SuperAdminResumeAnalytics from "@/components/super-admin/SuperAdminResumeAnalytics";
import SuperAdminResumeBrowser from "@/components/super-admin/SuperAdminResumeBrowser";
import {
  saChip,
  saChipActive,
  saMono,
  saPage,
} from "@/components/super-admin/resume-dashboard-styles";
import { AUTH_LINKS } from "@/lib/constants";

type TabId = "analytics" | "search";

function SuperAdminResumesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab: TabId =
    rawTab === "search" || rawTab === "browse" ? "search" : "analytics";

  const tabs = useMemo(
    () =>
      [
        { id: "analytics" as const, label: "Analytics" },
        { id: "search" as const, label: "Search" },
      ] as const,
    []
  );

  function setTab(next: TabId) {
    const url =
      next === "search"
        ? `${AUTH_LINKS.superAdmin}/resumes?tab=search`
        : `${AUTH_LINKS.superAdmin}/resumes`;
    router.replace(url);
  }

  return (
    <div className={`${saPage} max-w-7xl`}>
      <SuperAdminHeader
        title="Resumes"
        subtitle="Platform analytics and cross-profile resume search — KPIs, trends, preview, and DOCX/PDF download."
        onLock={() => router.replace(AUTH_LINKS.superAdmin)}
      />

      <div className="mt-7 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={tab === t.id ? saChipActive : saChip}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 sa-animate-in-delay-1" key={tab}>
        {tab === "analytics" ? (
          <SuperAdminResumeAnalytics />
        ) : (
          <SuperAdminResumeBrowser />
        )}
      </div>
    </div>
  );
}

export default function SuperAdminResumesPage() {
  return (
    <SuperAdminGate>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center">
            <p className={`${saMono} text-xs text-[#6b7c8f]`}>Loading resume dashboard…</p>
          </div>
        }
      >
        <SuperAdminResumesInner />
      </Suspense>
    </SuperAdminGate>
  );
}
