"use client";

import Link from "next/link";
import { AUTH_LINKS } from "@/lib/constants";
import { lockSuperAdminSession } from "@/components/super-admin/SuperAdminGate";

type SuperAdminHeaderProps = {
  title: string;
  subtitle?: string;
  onLock?: () => void;
};

export default function SuperAdminHeader({ title, subtitle, onLock }: SuperAdminHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-teal-400/20 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-[family-name:var(--font-sa-mono)] text-[11px] font-medium uppercase tracking-[0.22em] text-teal-300/80">
          Control plane
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-sa-display)] text-3xl font-extrabold tracking-tight text-[#f4f7fb] sm:text-4xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-xl font-[family-name:var(--font-sa-mono)] text-sm leading-relaxed text-[#8b9aab]">
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={AUTH_LINKS.superAdmin}
          className="inline-flex h-10 items-center justify-center border border-[#2a3a4a] bg-[#101820] px-4 font-[family-name:var(--font-sa-mono)] text-xs font-semibold uppercase tracking-wider text-[#9aabbc] transition-colors hover:border-teal-400/30 hover:text-teal-200"
        >
          Hub
        </Link>
        <button
          type="button"
          onClick={() => {
            lockSuperAdminSession();
            onLock?.();
          }}
          className="inline-flex h-10 items-center justify-center border border-[#2a3a4a] bg-[#101820] px-4 font-[family-name:var(--font-sa-mono)] text-xs font-semibold uppercase tracking-wider text-[#9aabbc] transition-colors hover:border-teal-400/30 hover:text-teal-200"
        >
          Lock
        </button>
        <Link
          href={AUTH_LINKS.dashboard}
          className="inline-flex h-10 items-center justify-center border border-teal-400/30 bg-teal-400/5 px-4 font-[family-name:var(--font-sa-mono)] text-xs font-semibold uppercase tracking-wider text-teal-200 transition-colors hover:border-teal-300/50 hover:bg-teal-400/10"
        >
          ← Dashboard
        </Link>
      </div>
    </header>
  );
}
