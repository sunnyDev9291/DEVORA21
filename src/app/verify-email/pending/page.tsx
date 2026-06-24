"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthLayout from "@/components/auth/AuthLayout";
import Button from "@/components/ui/Button";
import { PendingVerificationGuard } from "@/components/auth/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import { AUTH_LINKS } from "@/lib/constants";

function PendingVerificationContent() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshUser();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    router.replace(AUTH_LINKS.login);
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle="One more step before you can use Devora21 tools"
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
          <p>
            We sent a verification link to{" "}
            <span className="font-semibold text-white">{user?.email}</span>. Open it to unlock your
            dashboard, resume builder, and live interview tools.
          </p>
        </div>

        <ul className="space-y-2 text-sm text-slate-400 list-disc pl-5">
          <li>Check your inbox and spam folder</li>
          <li>Click the link in the email, then press refresh below</li>
          <li>Wrong address? Sign out and register again with the correct email</li>
        </ul>

        <div className="flex flex-col gap-3">
          <Button type="button" className="w-full" disabled={refreshing} onClick={() => void handleRefresh()}>
            {refreshing ? "Checking…" : "I verified — check again"}
          </Button>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/[0.05] transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}

export default function VerifyEmailPendingPage() {
  return (
    <PendingVerificationGuard>
      <PendingVerificationContent />
    </PendingVerificationGuard>
  );
}
