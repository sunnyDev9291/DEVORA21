"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SuperAdminGate } from "@/components/super-admin/SuperAdminGate";
import SuperAdminHeader from "@/components/super-admin/SuperAdminHeader";
import {
  saCard,
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
    body: "List every account, open a profile, edit identity, crawl URLs, template, prompt, and resume builder access.",
    delay: "sa-animate-in-delay-1",
  },
  {
    href: `${AUTH_LINKS.superAdmin}/resumes`,
    eyebrow: "Module 02",
    title: "Resume analytics",
    body: "Platform KPIs, trends, search every archived resume, preview PDF, download DOCX/PDF, open job descriptions.",
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
          subtitle="Separate ops surface — not the product UI. Sign in to Devora21 with a super-admin account before using modules that call /admin APIs."
          onLock={() => router.replace(AUTH_LINKS.superAdmin)}
        />

        <section className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className={`${saCard} sa-animate-in p-6`}>
            <p className={saEyebrow}>Operator</p>
            <p className={`${saMono} mt-4 text-sm text-[#f4f7fb]`}>
              Temporary console gate · session only
            </p>
            <p className={`${saMono} mt-2 text-xs leading-relaxed text-[#6b7c8f]`}>
              Cleared when the tab session ends or you hit Lock. API auth uses your Devora21 JWT.
            </p>
            <div className="mt-5 h-px w-full bg-gradient-to-r from-teal-400/30 via-teal-400/10 to-transparent" />
            <p className={`${saMono} mt-4 text-[11px] text-teal-200/70`}>Live session</p>
          </div>

          {modules.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className={`${saCardInteractive} ${mod.delay} group block p-6`}
            >
              <p className={saEyebrow}>{mod.eyebrow}</p>
              <p
                className={`${saDisplay} mt-4 text-xl font-bold tracking-tight text-[#f4f7fb] transition-colors group-hover:text-teal-100`}
              >
                {mod.title}
              </p>
              <p className={`${saMono} mt-2 text-xs leading-relaxed text-[#6b7c8f]`}>{mod.body}</p>
              <span
                className={`${saMono} mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-300/80 transition-all group-hover:gap-3 group-hover:text-teal-200`}
              >
                Open <span aria-hidden>→</span>
              </span>
            </Link>
          ))}
        </section>
      </div>
    </SuperAdminGate>
  );
}
