"use client";

import Link from "next/link";
import { AUTH_LINKS } from "@/lib/constants";
import { lockSuperAdminSession } from "@/components/super-admin/SuperAdminGate";
import {
  saBtnGhost,
  saDisplay,
  saEyebrow,
  saMono,
} from "@/components/super-admin/resume-dashboard-styles";

type SuperAdminHeaderProps = {
  title: string;
  subtitle?: string;
  onLock?: () => void;
};

export default function SuperAdminHeader({ title, subtitle, onLock }: SuperAdminHeaderProps) {
  return (
    <header className="flex flex-col gap-5 border-b border-slate-200/80 pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
          <p className={saEyebrow}>Control plane</p>
        </div>
        <h1
          className={`${saDisplay} mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-[2.5rem] sm:leading-none`}
        >
          {title}
        </h1>
        {subtitle ? (
          <p className={`${saMono} mt-3 max-w-2xl text-sm leading-relaxed text-slate-500`}>
            {subtitle}
          </p>
        ) : null}
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="Super admin actions">
        <Link href={AUTH_LINKS.superAdmin} className={saBtnGhost}>
          Hub
        </Link>
        <button
          type="button"
          onClick={() => {
            lockSuperAdminSession();
            onLock?.();
          }}
          className={saBtnGhost}
        >
          Logout from superadmin
        </button>
      </nav>
    </header>
  );
}
