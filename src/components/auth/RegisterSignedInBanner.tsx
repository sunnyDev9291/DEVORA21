"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { getPostAuthRedirectPath } from "@/lib/auth-redirect";
import { AUTH_LINKS } from "@/lib/constants";
import type { User } from "@/types/auth";

export default function RegisterSignedInBanner({ user }: { user: User }) {
  const { isEmailVerified, logout } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-900 dark:text-amber-100">
      <p>
        You are signed in as <span className="font-semibold text-stone-900 dark:text-white">{user.email}</span>.
        Use <span className="font-semibold text-stone-900 dark:text-white">Sign up with Google</span> above only if
        you want a different Google account (you will be signed out first).
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button type="button" size="sm" variant="outline" onClick={() => router.replace(getPostAuthRedirectPath(user))}>
          {isEmailVerified ? "Go to dashboard" : "Continue verification"}
        </Button>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          className="inline-flex items-center justify-center rounded-xl border border-orange-200 px-3 py-2 text-xs font-semibold text-stone-800 hover:bg-orange-50 disabled:opacity-50 dark:border-white/10 dark:text-stone-100 dark:hover:bg-white/[0.05]"
        >
          {signingOut ? "Signing out…" : "Sign out to use email signup"}
        </button>
        <Link
          href={AUTH_LINKS.login}
          className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700 dark:text-amber-200 dark:hover:text-white"
        >
          Sign in page
        </Link>
      </div>
    </div>
  );
}
