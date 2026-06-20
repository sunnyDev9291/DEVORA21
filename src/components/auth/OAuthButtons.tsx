"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/lib/auth-api";
import { getGoogleOAuthUrl, type GoogleOAuthIntent } from "@/lib/auth-oauth";
import { clearAuthClientStorage } from "@/lib/auth-storage";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.21 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

const oauthClass =
  "w-full inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 border border-white/10 hover:border-white/25 bg-white/[0.03] hover:bg-white/[0.06] text-white px-5 py-2.5 text-sm rounded-xl disabled:opacity-60 disabled:pointer-events-none";

interface OAuthButtonsProps {
  mode: GoogleOAuthIntent;
}

export default function OAuthButtons({ mode }: OAuthButtonsProps) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);

  const label = mode === "signup" ? "Sign up with Google" : "Sign in with Google";

  async function handleClick() {
    setBusy(true);
    try {
      // Signup must never reuse an existing API session (prevents silent dashboard redirect).
      if (mode === "signup") {
        clearAuthClientStorage(user?.id);
        try {
          await authApi.logout();
        } catch {
          // Continue — user may already be logged out.
        }
      }

      const next = mode === "login" ? searchParams.get("next") : null;
      window.location.href = getGoogleOAuthUrl({ intent: mode, next });
    } catch {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={oauthClass} disabled={busy} onClick={() => void handleClick()}>
      <GoogleIcon />
      {busy ? "Redirecting…" : label}
    </button>
  );
}
