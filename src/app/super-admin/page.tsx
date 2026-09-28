"use client";

import Link from "next/link";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AUTH_LINKS } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";

function SuperAdminContent() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-4 border-b border-teal-400/20 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p
            className="font-[family-name:var(--font-sa-mono)] text-[11px] font-medium uppercase tracking-[0.22em] text-teal-300/80"
          >
            Control plane · v0
          </p>
          <h1
            className="mt-2 font-[family-name:var(--font-sa-display)] text-3xl font-extrabold tracking-tight text-[#f4f7fb] sm:text-4xl"
          >
            Super Admin
          </h1>
          <p className="mt-2 max-w-xl font-[family-name:var(--font-sa-mono)] text-sm leading-relaxed text-[#8b9aab]">
            Separate ops surface — not the product UI. Tools will land here next.
          </p>
        </div>
        <Link
          href={AUTH_LINKS.dashboard}
          className="inline-flex h-10 items-center justify-center border border-teal-400/30 bg-teal-400/5 px-4 font-[family-name:var(--font-sa-mono)] text-xs font-semibold uppercase tracking-wider text-teal-200 transition-colors hover:border-teal-300/50 hover:bg-teal-400/10"
        >
          ← Dashboard
        </Link>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="border border-[#1e2a36] bg-[#101820] p-5">
          <p className="font-[family-name:var(--font-sa-mono)] text-[10px] uppercase tracking-[0.18em] text-teal-400/70">
            Session
          </p>
          <p className="mt-3 font-[family-name:var(--font-sa-mono)] text-sm text-[#f4f7fb]">
            {user?.email ?? "—"}
          </p>
          <p className="mt-1 font-[family-name:var(--font-sa-mono)] text-xs text-[#6b7c8f]">
            Signed-in operator view (role gate comes later)
          </p>
        </div>

        <div className="border border-dashed border-[#2a3a4a] bg-[#0d141c] p-5">
          <p className="font-[family-name:var(--font-sa-mono)] text-[10px] uppercase tracking-[0.18em] text-[#6b7c8f]">
            Modules
          </p>
          <p className="mt-3 font-[family-name:var(--font-sa-display)] text-lg font-bold text-[#c5d0dc]">
            Empty bay
          </p>
          <p className="mt-1 font-[family-name:var(--font-sa-mono)] text-xs leading-relaxed text-[#6b7c8f]">
            Placeholder. Admin actions will be wired here after the shell.
          </p>
        </div>
      </section>

      <div className="mt-8 border border-teal-400/15 bg-teal-400/[0.04] px-4 py-3 font-[family-name:var(--font-sa-mono)] text-xs text-teal-200/80">
        Style note: grid, mono type, square edges, teal on near-black — deliberately unlike the warm
        orange product pages.
      </div>
    </div>
  );
}

export default function SuperAdminPage() {
  return (
    <AuthGuard>
      <SuperAdminContent />
    </AuthGuard>
  );
}
