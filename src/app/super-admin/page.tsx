"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SuperAdminGate } from "@/components/super-admin/SuperAdminGate";
import SuperAdminHeader from "@/components/super-admin/SuperAdminHeader";
import { AUTH_LINKS } from "@/lib/constants";

export default function SuperAdminPage() {
  const router = useRouter();

  return (
    <SuperAdminGate>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <SuperAdminHeader
          title="Super Admin"
          subtitle="Separate ops surface — not the product UI. Sign in to Devora21 with a super-admin account before using modules that call /admin APIs."
          onLock={() => router.replace(AUTH_LINKS.superAdmin)}
        />

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="border border-[#1e2a36] bg-[#101820] p-5">
            <p className="font-[family-name:var(--font-sa-mono)] text-[10px] uppercase tracking-[0.18em] text-teal-400/70">
              Operator
            </p>
            <p className="mt-3 font-[family-name:var(--font-sa-mono)] text-sm text-[#f4f7fb]">
              Temporary console gate · session only
            </p>
            <p className="mt-1 font-[family-name:var(--font-sa-mono)] text-xs text-[#6b7c8f]">
              Cleared when the tab session ends or you hit Lock. API auth uses your Devora21 JWT.
            </p>
          </div>

          <Link
            href={`${AUTH_LINKS.superAdmin}/profiles`}
            className="border border-teal-400/25 bg-[#101820] p-5 transition-colors hover:border-teal-300/45 hover:bg-teal-400/5"
          >
            <p className="font-[family-name:var(--font-sa-mono)] text-[10px] uppercase tracking-[0.18em] text-teal-400/70">
              Module
            </p>
            <p className="mt-3 font-[family-name:var(--font-sa-display)] text-lg font-bold text-[#f4f7fb]">
              Profile management
            </p>
            <p className="mt-1 font-[family-name:var(--font-sa-mono)] text-xs leading-relaxed text-[#6b7c8f]">
              List all users, open a profile, edit identity, crawl URLs, template, prompt, and resume
              builder access.
            </p>
          </Link>

          <Link
            href={`${AUTH_LINKS.superAdmin}/resumes`}
            className="border border-teal-400/25 bg-[#101820] p-5 transition-colors hover:border-teal-300/45 hover:bg-teal-400/5"
          >
            <p className="font-[family-name:var(--font-sa-mono)] text-[10px] uppercase tracking-[0.18em] text-teal-400/70">
              Module
            </p>
            <p className="mt-3 font-[family-name:var(--font-sa-display)] text-lg font-bold text-[#f4f7fb]">
              Resume analytics
            </p>
            <p className="mt-1 font-[family-name:var(--font-sa-mono)] text-xs leading-relaxed text-[#6b7c8f]">
              Platform KPIs, trends, search every archived resume, preview PDF, download DOCX/PDF, open
              job descriptions.
            </p>
          </Link>
        </section>
      </div>
    </SuperAdminGate>
  );
}
