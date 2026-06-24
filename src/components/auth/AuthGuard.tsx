"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { isUserEmailVerified } from "@/lib/email-verification";
import { needsOnboarding } from "@/lib/onboarding";
import { isResumeBuilderEnabled, resumeAccessPendingUrl } from "@/lib/resume-access";
import { buildLoginUrl, getPostAuthRedirectPath } from "@/lib/auth-redirect";
import { AUTH_LINKS } from "@/lib/constants";

function AuthLoadingSpinner() {
  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-navy-950">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>
  );
}

export function GuestGuard({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      router.replace(getPostAuthRedirectPath(user, params?.get("next")));
    }
  }, [isAuthenticated, isLoading, router, pathname, user]);

  if (isLoading) {
    return <AuthLoadingSpinner />;
  }

  if (isAuthenticated) return null;

  return <>{children}</>;
}

interface AuthGuardProps {
  children: ReactNode;
  /** Set on /onboarding so this guard does not redirect back to onboarding. */
  skipOnboardingRedirect?: boolean;
  /** Require resumeBuilderEnabled === true (for /resume). */
  requireResumeBuilder?: boolean;
}

export function AuthGuard({
  children,
  skipOnboardingRedirect = false,
  requireResumeBuilder = false,
}: AuthGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const emailVerified = isUserEmailVerified(user);
  const onboardingRequired = Boolean(user && emailVerified && needsOnboarding(user));
  const resumeAllowed = isResumeBuilderEnabled(user);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace(buildLoginUrl(pathname));
      return;
    }

    if (!emailVerified) {
      router.replace(AUTH_LINKS.verifyEmailPending);
      return;
    }

    if (!skipOnboardingRedirect && onboardingRequired && pathname !== AUTH_LINKS.onboarding) {
      router.replace(AUTH_LINKS.onboarding);
      return;
    }

    if (requireResumeBuilder && !resumeAllowed) {
      router.replace(resumeAccessPendingUrl());
    }
  }, [
    isAuthenticated,
    isLoading,
    router,
    pathname,
    emailVerified,
    skipOnboardingRedirect,
    onboardingRequired,
    requireResumeBuilder,
    resumeAllowed,
  ]);

  if (isLoading) {
    return <AuthLoadingSpinner />;
  }

  if (!isAuthenticated || !emailVerified) return null;

  if (!skipOnboardingRedirect && onboardingRequired && pathname !== AUTH_LINKS.onboarding) {
    return null;
  }

  if (requireResumeBuilder && !resumeAllowed) {
    return null;
  }

  return <>{children}</>;
}

/** Signed in but email not verified yet — for the verification waiting page. */
export function PendingVerificationGuard({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const emailVerified = isUserEmailVerified(user);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace(AUTH_LINKS.login);
      return;
    }

    if (emailVerified && user) {
      router.replace(getPostAuthRedirectPath(user));
    }
  }, [isAuthenticated, isLoading, router, emailVerified, user]);

  if (isLoading) {
    return <AuthLoadingSpinner />;
  }

  if (!isAuthenticated || emailVerified) return null;

  return <>{children}</>;
}

/** Register page only — never auto-redirect; show children for guests or signed-in users. */
export function RegisterPageGuard({ children }: { children: ReactNode }) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoadingSpinner />;
  }

  return <>{children}</>;
}
