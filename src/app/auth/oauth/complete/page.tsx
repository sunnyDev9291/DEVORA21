"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { isValidAuthUser } from "@/lib/auth-api";
import { fetchSessionUser } from "@/lib/auth-session";
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

      const treatAsLogin =
        result === OAUTH_NOTICE.loginSuccess ||
        result === "login_success" ||
        !result;

      if (treatAsLogin) {
        // Soft retries: cookie may not be visible on the first tick after redirect.
        await refreshUser({ softRetry: true });
        if (cancelled) return;

        let session = await fetchSessionUser({ softRetry: true });
        if (cancelled) return;

        if (session.status === "authenticated" && isValidAuthUser(session.user)) {
          router.replace(getPostAuthRedirectPath(session.user, next ?? getSafeRedirectPath(null)));
          return;
        }

        // Do not clear auth solely because one race returned 401 — delayed retry.
        await new Promise((r) => setTimeout(r, 600));
        await refreshUser({ softRetry: true });
        if (cancelled) return;

        session = await fetchSessionUser({ softRetry: true });
        if (cancelled) return;

        if (session.status === "authenticated" && isValidAuthUser(session.user)) {
          router.replace(getPostAuthRedirectPath(session.user, next ?? getSafeRedirectPath(null)));
          return;
        }

        if (result === OAUTH_NOTICE.loginSuccess || result === "login_success") {
          router.replace(`${AUTH_LINKS.login}?notice=${OAUTH_NOTICE.oauthError}`);
          return;
        }

        router.replace(AUTH_LINKS.login);
        return;
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
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-warm-950">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        <p className="mt-4 text-sm text-slate-400">Completing Google sign-in…</p>
      </div>
    </div>
  );
}

export default function OAuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-warm-950">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
      }
    >
      <OAuthCompleteContent />
    </Suspense>
  );
}
