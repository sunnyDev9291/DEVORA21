"use client";



import Link from "next/link";

import { AUTH_LINKS } from "@/lib/constants";

import { isUserEmailVerified } from "@/lib/email-verification";

import type { User } from "@/types/auth";



export default function EmailVerificationBanner({ user }: { user: User }) {

  if (isUserEmailVerified(user)) return null;



  return (

    <div

      className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"

      role="status"

    >

      <p>

        Your email is not verified yet.{" "}

        <Link

          href={AUTH_LINKS.verifyEmailPending}

          className="font-semibold text-amber-200 underline underline-offset-2 hover:text-white"

        >

          Complete verification

        </Link>{" "}

        to keep full access to your account.

      </p>

    </div>

  );

}


