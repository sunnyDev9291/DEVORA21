"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/lib/auth-api";
import { AUTH_LINKS } from "@/lib/constants";

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

  return (
    <AuthGuard>
      <div className="min-h-[calc(100vh-5rem)] bg-navy-950 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-5xl animate-fade-up">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">
                Welcome{user?.name ? `, ${user.name}` : ""}
              </h1>
              <p className="mt-2 text-slate-400">You&apos;re signed in to your Devora21 dashboard.</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
              {error}
            </div>
          )}

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-navy-900/60 p-6">
              <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">Account</h2>
              <dl className="mt-4 space-y-3">
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
              </dl>
            </div>
            <div className="rounded-2xl border border-white/10 bg-navy-900/60 p-6">
              <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">Quick actions</h2>
              <ul className="mt-4 space-y-2 text-sm text-slate-300">
                <li>Resume builder</li>
                <li>Interview prep</li>
                <li>Account settings</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
