"use client";

import { Suspense } from "react";
import OAuthButtons from "@/components/auth/OAuthButtons";
import OAuthNotice from "@/components/auth/OAuthNotice";
import type { GoogleOAuthIntent } from "@/lib/auth-oauth";

function OAuthFallback() {
  return (
    <div
      className="h-[42px] w-full animate-pulse rounded-xl border border-white/10 bg-white/[0.04]"
      aria-hidden
    />
  );
}

interface GoogleOAuthSectionProps {
  mode: GoogleOAuthIntent;
  page: "login" | "register";
}

export default function GoogleOAuthSection({ mode, page }: GoogleOAuthSectionProps) {
  return (
    <div className="space-y-4">
      <Suspense fallback={<OAuthFallback />}>
        <OAuthNotice page={page} />
        <OAuthButtons mode={mode} />
      </Suspense>
    </div>
  );
}
