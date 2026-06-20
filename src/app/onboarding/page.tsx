"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import { isValidAuthUser } from "@/lib/auth-api";
import { isUserEmailVerified } from "@/lib/email-verification";
import { needsOnboarding } from "@/lib/onboarding";
import { AUTH_LINKS } from "@/lib/constants";

function OnboardingContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !user) return;

    if (!isUserEmailVerified(user)) {
      router.replace(AUTH_LINKS.verifyEmailPending);
      return;
    }

    if (!needsOnboarding(user)) {
      router.replace(AUTH_LINKS.dashboard);
    }
  }, [isLoading, user, router]);

  if (isLoading || !user || !isValidAuthUser(user)) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-navy-950">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!isUserEmailVerified(user) || !needsOnboarding(user)) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-navy-950">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-5rem)] bg-navy-950 px-4 py-12 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.12),_transparent_50%)]" aria-hidden />
      <OnboardingWizard user={user} />
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <AuthGuard skipOnboardingRedirect>
      <OnboardingContent />
    </AuthGuard>
  );
}
