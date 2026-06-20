"use client";

import Link from "next/link";
import { AUTH_LINKS } from "@/lib/constants";
import type { User } from "@/types/auth";

export default function EmailVerificationBanner({ user }: { user: User }) {
  if (user.emailVerified !== false) return null;

  return (
    <div
      className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
      role="status"
    >
      <p>
        Your email is not verified yet. Check your inbox for a verification link, or{" "}
        <Link href={AUTH_LINKS.login} className="font-semibold text-amber-200 underline underline-offset-2 hover:text-white">
          sign in again
        </Link>{" "}
        after verifying.
      </p>
    </div>
  );
}
