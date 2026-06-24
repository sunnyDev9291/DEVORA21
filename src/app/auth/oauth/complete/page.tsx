"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { isValidAuthUser } from "@/lib/auth-api";
import { OAUTH_NOTICE } from "@/lib/auth-oauth";
import { getPostAuthRedirectPath, getSafeRedirectPath } from "@/lib/auth-redirect";
import { AUTH_LINKS } from "@/lib/constants";

/**
 * Landing page after Google OAuth callback (backend redirect target).
 * Routes users based on `result` without keeping signup sessions alive.
 */
function OAuthCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const result = searchParams.get("result") ?? searchParams.get("notice");
      const next = searchParams.get("next");

      if (result === OAUTH_NOTICE.signupSuccess) {
        router.replace(`${AUTH_LINKS.login}?notice=${OAUTH_NOTICE.signupSuccess}`);
        return;
      }

      if (result === OAUTH_NOTICE.googleAlreadyRegistered) {
        router.replace(`${AUTH_LINKS.register}?notice=${OAUTH_NOTICE.googleAlreadyRegistered}`);
        return;
      }

      if (result === OAUTH_NOTICE.oauthError) {
        const message = searchParams.get("message");
        const query = message
          ? `?notice=${OAUTH_NOTICE.oauthError}&message=${encodeURIComponent(message)}`
          : `?notice=${OAUTH_NOTICE.oauthError}`;
        router.replace(`${AUTH_LINKS.login}${query}`);
        return;
      }

      if (result === OAUTH_NOTICE.loginSuccess || result === "login_success") {
        try {
          await refreshUser();
        } catch {
          // fall through to login
        }

        if (cancelled) return;

        // Re-fetch user from context after refresh — use getMe via redirect check
        try {
          const { authApi } = await import("@/lib/auth-api");
          const { data } = await authApi.getMe();
          if (isValidAuthUser(data)) {
            router.replace(getPostAuthRedirectPath(data, next));
            return;
          }
        } catch {
          // no session
        }

        router.replace(`${AUTH_LINKS.login}?notice=${OAUTH_NOTICE.oauthError}`);
        return;
      }

      // Default: backend set session cookie and sent user here without result — treat as login.
      try {
        const { authApi } = await import("@/lib/auth-api");
        const { data } = await authApi.getMe();
        if (!cancelled && isValidAuthUser(data)) {
          router.replace(getPostAuthRedirectPath(data, next ?? getSafeRedirectPath(null)));
          return;
        }
      } catch {
        // ignore
      }

      if (!cancelled) {
        router.replace(AUTH_LINKS.login);
      }
    }

    void finish();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams, refreshUser]);

  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-navy-950">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <p className="mt-4 text-sm text-slate-400">Completing Google sign-in…</p>
      </div>
    </div>
  );
}

export default function OAuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-navy-950">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      }
    >
      <OAuthCompleteContent />
    </Suspense>
  );
}
