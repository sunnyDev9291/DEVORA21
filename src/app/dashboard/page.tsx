"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import EmailVerificationBanner from "@/components/auth/EmailVerificationBanner";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/lib/auth-api";
import { AUTH_LINKS, APP_FEATURES } from "@/lib/constants";

const quickActions = [
  {
    title: APP_FEATURES.resume.label,
    description: APP_FEATURES.resume.description,
    href: APP_FEATURES.resume.href,
    accent: "border-blue-500/20 hover:border-blue-500/40 bg-blue-500/[0.06]",
  },
  {
    title: APP_FEATURES.realTimeInterview.label,
    description: APP_FEATURES.realTimeInterview.description,
    href: APP_FEATURES.realTimeInterview.href,
    accent: "border-violet-500/20 hover:border-violet-500/40 bg-violet-500/[0.06]",
  },
];

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState("");

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

  const initials = (user?.name || user?.email || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <AuthGuard>
      <div className="min-h-[calc(100vh-5rem)] bg-navy-950 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-5xl animate-fade-up">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15 text-sm font-bold text-blue-300 ring-1 ring-blue-500/25">
                {initials}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
                </h1>
                <p className="mt-1 text-slate-400">{user?.email}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>

          {user && (
            <div className="mt-6">
              <EmailVerificationBanner user={user} />
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
              {error}
            </div>
          )}

          <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="rounded-2xl border border-white/10 bg-navy-900/60 p-6">
              <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">Account</h2>
              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-xs text-slate-500">Email</dt>
                  <dd className="mt-0.5 text-sm font-medium text-white">{user?.email ?? "—"}</dd>
                </div>
                {user?.name && (
                  <div>
                    <dt className="text-xs text-slate-500">Name</dt>
                    <dd className="mt-0.5 text-sm font-medium text-white">{user.name}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-slate-500">Email status</dt>
                  <dd className="mt-0.5 text-sm font-medium text-white">
                    {user?.emailVerified === false ? "Not verified" : "Verified"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-white/10 bg-navy-900/60 p-6">
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
      </div>
    </AuthGuard>
  );
}
