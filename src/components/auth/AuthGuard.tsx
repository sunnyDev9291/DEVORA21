"use client";



import { useEffect, type ReactNode } from "react";

import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";

import { isUserEmailVerified } from "@/lib/email-verification";

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



export function AuthGuard({ children }: { children: ReactNode }) {

  const { user, isAuthenticated, isLoading } = useAuth();

  const router = useRouter();

  const pathname = usePathname();

  const emailVerified = isUserEmailVerified(user);



  useEffect(() => {

    if (isLoading) return;



    if (!isAuthenticated) {

      router.replace(buildLoginUrl(pathname));

      return;

    }



    if (!emailVerified) {

      router.replace(AUTH_LINKS.verifyEmailPending);

    }

  }, [isAuthenticated, isLoading, router, pathname, emailVerified]);



  if (isLoading) {

    return <AuthLoadingSpinner />;

  }



  if (!isAuthenticated || !emailVerified) return null;



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



    if (emailVerified) {

      router.replace(AUTH_LINKS.dashboard);

    }

  }, [isAuthenticated, isLoading, router, emailVerified]);



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

