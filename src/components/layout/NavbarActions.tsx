"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { APP_FEATURES, AUTH_LINKS, CONTACT_INFO } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/lib/auth-api";
import { useState } from "react";

function ResumeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function InterviewIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

const featureIcons = {
  resume: ResumeIcon,
  realTimeInterview: InterviewIcon,
} as const;

const toolActiveClasses = {
  blue: "bg-blue-500/15 text-blue-600 dark:text-blue-300 shadow-sm shadow-blue-500/10",
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-300 shadow-sm shadow-violet-500/10",
} as const;

const toolIdleClasses =
  "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.06]";

const mobileAccentClasses = {
  blue: "border-blue-500/25 bg-blue-500/[0.06] hover:border-blue-500/40 hover:bg-blue-500/[0.1]",
  violet: "border-violet-500/25 bg-violet-500/[0.06] hover:border-violet-500/40 hover:bg-violet-500/[0.1]",
} as const;

const features = [
  { key: "resume" as const, ...APP_FEATURES.resume },
  { key: "realTimeInterview" as const, ...APP_FEATURES.realTimeInterview },
];

interface NavbarActionsProps {
  variant: "desktop" | "mobile";
  onNavigate?: () => void;
}

export default function NavbarActions({ variant, onNavigate }: NavbarActionsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      onNavigate?.();
      router.push(AUTH_LINKS.login);
    } catch (error) {
      console.error(getApiErrorMessage(error, "Logout failed"));
      setIsLoggingOut(false);
    }
  };

  const authButtonsDesktop = isLoading ? (
    <div className="h-9 w-24 animate-pulse rounded-xl bg-slate-200/50 dark:bg-white/[0.06]" aria-hidden />
  ) : isAuthenticated ? (
    <>
      <Link
        href={AUTH_LINKS.dashboard}
        className={`inline-flex items-center px-3.5 py-2 rounded-xl text-xs xl:text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
          pathname === AUTH_LINKS.dashboard
            ? "text-blue-600 dark:text-blue-300 bg-blue-500/10"
            : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.06]"
        }`}
      >
        Dashboard
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs xl:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-all disabled:opacity-50"
      >
        {isLoggingOut ? "Signing out…" : "Sign out"}
      </button>
    </>
  ) : (
    <>
      <Link
        href={AUTH_LINKS.login}
        className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs xl:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-all whitespace-nowrap"
      >
        Sign in
      </Link>
      <Link
        href={AUTH_LINKS.register}
        className="inline-flex items-center px-3.5 xl:px-4 py-2 rounded-xl text-xs xl:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/20 whitespace-nowrap"
      >
        Sign up
      </Link>
    </>
  );

  if (variant === "desktop") {
    return (
      <div className="flex items-center gap-2 xl:gap-3">
        <div
          className="inline-flex items-center gap-0.5 p-1 rounded-xl bg-slate-100/90 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] backdrop-blur-sm"
          role="group"
          aria-label="Devora21 tools"
        >
          {features.map((feature) => {
            const Icon = featureIcons[feature.key];
            const isActive = pathname === feature.href;
            const accent = feature.accent as keyof typeof toolActiveClasses;

            return (
              <Link
                key={feature.key}
                href={feature.href}
                aria-current={isActive ? "page" : undefined}
                title={feature.label}
                className={`inline-flex items-center gap-1.5 px-2.5 xl:px-3.5 py-2 rounded-lg text-xs xl:text-sm font-semibold transition-all duration-200 ${
                  isActive ? toolActiveClasses[accent] : toolIdleClasses
                }`}
              >
                <Icon className="w-3.5 h-3.5 xl:w-4 xl:h-4 flex-shrink-0" />
                <span className="hidden xl:inline">{feature.shortLabel}</span>
              </Link>
            );
          })}
        </div>

        {authButtonsDesktop}

        <a
          href={CONTACT_INFO.calendly}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs xl:text-sm font-semibold px-3.5 xl:px-5 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/25 hover:shadow-blue-500/35 hover:-translate-y-px whitespace-nowrap"
        >
          <span className="hidden 2xl:inline">Book Free Consultation</span>
          <span className="2xl:hidden">Book Call</span>
          <svg className="w-3.5 h-3.5 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </a>
      </div>
    );
  }

  return (
    <div className="pt-4 mt-2 border-t border-white/[0.06] space-y-3">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Account</p>
      <div className="grid grid-cols-2 gap-2">
        {isLoading ? (
          <div className="col-span-2 h-11 animate-pulse rounded-xl bg-white/[0.06]" aria-hidden />
        ) : isAuthenticated ? (
          <>
            <Link
              href={AUTH_LINKS.dashboard}
              onClick={onNavigate}
              className="flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white hover:bg-white/[0.08] transition-colors"
            >
              Dashboard
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/[0.08] transition-colors disabled:opacity-50"
            >
              {isLoggingOut ? "Signing out…" : "Sign out"}
            </button>
          </>
        ) : (
          <>
            <Link
              href={AUTH_LINKS.login}
              onClick={onNavigate}
              className="flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white hover:bg-white/[0.08] transition-colors"
            >
              Sign in
            </Link>
            <Link
              href={AUTH_LINKS.register}
              onClick={onNavigate}
              className="flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition-colors"
            >
              Sign up
            </Link>
          </>
        )}
      </div>

      <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Tools</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {features.map((feature) => {
          const Icon = featureIcons[feature.key];
          const accent = feature.accent as keyof typeof mobileAccentClasses;
          const isActive = pathname === feature.href;

          return (
            <Link
              key={feature.key}
              href={feature.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-start gap-3 rounded-2xl border p-4 transition-all ${
                isActive
                  ? `${mobileAccentClasses[accent]} ring-1 ring-white/10`
                  : `${mobileAccentClasses[accent]} opacity-90 hover:opacity-100`
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0 text-slate-200">
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0 text-left">
                <p className="text-sm font-semibold text-white leading-tight">{feature.label}</p>
                <p className="text-xs text-slate-500 mt-1">{feature.description}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <a
        href={CONTACT_INFO.calendly}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold px-5 py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/25"
      >
        Book Free Consultation
        <svg className="w-4 h-4 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </a>
    </div>
  );
}
