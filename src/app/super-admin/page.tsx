"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SuperAdminGate } from "@/components/super-admin/SuperAdminGate";
import SuperAdminGatewaySettingsCard from "@/components/super-admin/SuperAdminGatewaySettingsCard";
import SuperAdminHeader from "@/components/super-admin/SuperAdminHeader";
import {
  saCardInteractive,
  saDisplay,
  saEyebrow,
  saMono,
  saPage,
} from "@/components/super-admin/resume-dashboard-styles";
import { AUTH_LINKS } from "@/lib/constants";

const modules = [
  {
    href: `${AUTH_LINKS.superAdmin}/profiles`,
    eyebrow: "Module 01",
    title: "Profile management",
    body: "Browse accounts in a sidebar, select a profile, and edit identity, crawl URLs, template, prompt, and resume builder access.",
    delay: "sa-animate-in-delay-1",
  },
  {
    href: `${AUTH_LINKS.superAdmin}/resumes`,
    eyebrow: "Module 02",
    title: "Resume analytics",
    body: "Compare profiles, inspect any date range, toggle bars and lines, and browse every archived resume.",
    delay: "sa-animate-in-delay-2",
  },
  {
    href: `${AUTH_LINKS.superAdmin}/application-captures`,
    eyebrow: "Module 03",
    title: "Application Captures",
    body: "Live three-panel review: profile → date → capture session → screenshot slices from the Capture extension.",
    delay: "sa-animate-in-delay-2",
  },
] as const;

export default function SuperAdminPage() {
  const router = useRouter();

  return (
    <SuperAdminGate>
      <div className={saPage}>
        <SuperAdminHeader
          title="Super Admin"
          subtitle="Quiet ops workspace for profiles, resume analytics, and Application Captures. Sign in to Devora21 with a super-admin account before calling /admin APIs."
          onLock={() => router.replace(AUTH_LINKS.superAdmin)}
        />

        <section className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className={`${saCardInteractive} ${mod.delay} group block p-6`}
            >
              <p className={saEyebrow}>{mod.eyebrow}</p>
              <p
                className={`${saDisplay} mt-4 text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-teal-800`}
              >
                {mod.title}
              </p>
              <p className={`${saMono} mt-2 text-xs leading-relaxed text-slate-500`}>{mod.body}</p>
              <span
                className={`${saMono} mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-700 transition-all group-hover:gap-3`}
              >
                Open <span aria-hidden>→</span>
              </span>
            </Link>
          ))}
        </section>

        <SuperAdminGatewaySettingsCard />
      </div>
    </SuperAdminGate>
  );
}
