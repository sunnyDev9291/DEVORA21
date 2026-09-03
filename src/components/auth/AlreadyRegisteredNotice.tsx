"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthLayout, { AuthFooterLink } from "@/components/auth/AuthLayout";
import Button from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { getPostAuthRedirectPath } from "@/lib/auth-redirect";
import { isValidAuthUser } from "@/lib/auth-api";
import { AUTH_LINKS } from "@/lib/constants";

export default function AlreadyRegisteredNotice() {
  const { user, isEmailVerified, logout } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  if (!user || !isValidAuthUser(user)) return null;

  const handleGoToAccount = () => {
    router.replace(getPostAuthRedirectPath(user));
  };

  const handleUseDifferentEmail = async () => {
    setSigningOut(true);
    try {
      await logout();
      router.replace(AUTH_LINKS.register);
    } catch {
      setSigningOut(false);
    }
  };

  return (
    <AuthLayout
      title="Account already exists"
      subtitle="You are already signed in"
      footer={
        <>
          Need a different account?{" "}
          <button
            type="button"
            onClick={() => void handleUseDifferentEmail()}
            disabled={signingOut}
            className="font-semibold text-orange-400 hover:text-orange-300 disabled:opacity-50"
          >
            {signingOut ? "Signing out…" : "Sign out and register"}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-100" role="alert">
          <p>
            An account with <span className="font-semibold text-white">{user.email}</span> already
            exists. You cannot create another account with the same email while signed in.
          </p>
        </div>

        <p className="text-sm text-slate-400 leading-relaxed">
          {isEmailVerified
            ? "Continue to your dashboard, or sign out first if you want to register with a different email."
            : "Finish verifying your email, or sign out first if you want to register with a different email."}
        </p>

        <div className="flex flex-col gap-3">
          <Button type="button" className="w-full" onClick={handleGoToAccount}>
            {isEmailVerified ? "Go to dashboard" : "Continue email verification"}
          </Button>
          <Link
            href={AUTH_LINKS.login}
            className="inline-flex w-full items-center justify-center rounded-xl border border-orange-200 px-4 py-2.5 text-sm font-semibold text-stone-800 hover:bg-orange-50 dark:border-white/10 dark:text-stone-100 dark:hover:bg-white/[0.05] transition-colors"
          >
            Sign in page
          </Link>
        </div>

        <p className="text-center text-xs text-slate-500">
          New here by mistake?{" "}
          <AuthFooterLink href={AUTH_LINKS.login}>Sign in</AuthFooterLink> with this email instead.
        </p>
      </div>
    </AuthLayout>
  );
}
