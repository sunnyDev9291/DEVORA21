"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import DashboardProfilePanel from "@/components/dashboard/DashboardProfilePanel";
import DashboardApiKeysPanel from "@/components/dashboard/DashboardApiKeysPanel";
import EmailVerificationBanner from "@/components/auth/EmailVerificationBanner";
import ResumeAccessNotice from "@/components/auth/ResumeAccessNotice";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage, isValidAuthUser } from "@/lib/auth-api";
import { resolveUserNames, loadStoredProfile } from "@/lib/user-profile";
import { AUTH_LINKS, APP_FEATURES } from "@/lib/constants";

function DashboardContent() {
  const { user, logout, refreshUser, isResumeBuilderEnabled } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const notice = searchParams.get("notice");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [, bumpProfileView] = useState(0);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const quickActions = [
    ...(isResumeBuilderEnabled
      ? [
          {
            title: APP_FEATURES.resume.label,
            description: APP_FEATURES.resume.description,
            href: APP_FEATURES.resume.href,
            accent: "border-blue-500/20 hover:border-blue-500/40 bg-blue-500/[0.06]",
          },
        ]
      : []),
    {
      title: APP_FEATURES.realTimeInterview.label,
      description: APP_FEATURES.realTimeInterview.description,
      href: APP_FEATURES.realTimeInterview.href,
      accent: "border-violet-500/20 hover:border-violet-500/40 bg-violet-500/[0.06]",
    },
  ];

  const handleLogout = async () => {
    setError("");
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace(AUTH_LINKS.login);
    } catch (err) {
      setError(getApiErrorMessage(err, "Logout failed. Please try again."));
      setIsLoggingOut(false);
    }
  };

  const names =
    user && isValidAuthUser(user)
      ? resolveUserNames(user, loadStoredProfile(user.id))
      : { firstName: "", lastName: "", fullName: "" };

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-navy-950 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-5xl animate-fade-up">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Welcome{names.firstName ? `, ${names.firstName}` : ""}
            </h1>
            <p className="mt-1 text-slate-400">{user?.email}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} disabled={isLoggingOut}>
            {isLoggingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>

        {user && isValidAuthUser(user) && (
          <div className="mt-6 space-y-4">
            <EmailVerificationBanner user={user} />
            <ResumeAccessNotice notice={notice} />
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
            {error}
          </div>
        )}

        {user && isValidAuthUser(user) && (
          <div className="mt-8 space-y-8">
            <DashboardProfilePanel
              user={user}
              onProfileUpdated={() => {
                bumpProfileView((n) => n + 1);
                void refreshUser();
              }}
            />
            <DashboardApiKeysPanel />
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-white/10 bg-navy-900/60 p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">Your tools</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={`rounded-xl border p-4 transition-all ${action.accent}`}
              >
                <p className="text-sm font-semibold text-white">{action.title}</p>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">{action.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <Suspense
        fallback={
          <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-navy-950">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </AuthGuard>
  );
}
