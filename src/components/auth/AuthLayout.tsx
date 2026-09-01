import type { ReactNode } from "react";
import Link from "next/link";
import { ui } from "@/lib/ui-styles";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className={`${ui.page} relative flex items-center justify-center overflow-hidden px-4 py-12`}>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.14),_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.18),_transparent_50%)]"
        aria-hidden
      />
      <div className="relative w-full max-w-md animate-fade-up">
        <div className={`${ui.cardCompact} shadow-card dark:shadow-card-dark`}>
          <div className="mb-6 text-center">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
            {subtitle && <p className={`mt-2 ${ui.mutedSm}`}>{subtitle}</p>}
          </div>
          {children}
        </div>
        {footer && <div className={`mt-6 text-center ${ui.mutedSm}`}>{footer}</div>}
      </div>
    </div>
  );
}

export function AuthDivider({ label = "or continue with email" }: { label?: string }) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <div className="w-full border-t border-slate-200 dark:border-white/10" />
      </div>
      <div className="relative flex justify-center text-xs uppercase tracking-wider">
        <span className="bg-white px-3 text-slate-500 dark:bg-navy-900/85 dark:text-slate-400">{label}</span>
      </div>
    </div>
  );
}

export function AuthFooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
      {children}
    </Link>
  );
}
