"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/auth/AuthLayout";
import Button from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { authApi, getApiErrorMessage } from "@/lib/auth-api";
import { AUTH_LINKS } from "@/lib/constants";
import { useSearchParams } from "next/navigation";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshUser, markEmailVerified } = useAuth();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("Invalid or missing verification token.");
      return;
    }

    let cancelled = false;

    authApi
      .verifyEmail(token)
      .then(async ({ data }) => {
        if (!cancelled) {
          markEmailVerified();
          await refreshUser();
          markEmailVerified();
          setState("success");
          setMessage(data.message || "Your email has been verified successfully.");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState("error");
          setMessage(getApiErrorMessage(error, "Email verification failed. The link may have expired."));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, refreshUser, markEmailVerified]);

  return (
    <AuthLayout
      title="Verify email"
      subtitle={
        state === "loading" ? "Confirming your email address…" : state === "success" ? "You're all set" : "Verification failed"
      }
    >
      <div className="space-y-6 text-center">
        {state === "loading" && (
          <div className="flex justify-center py-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        )}
        {state === "success" && (
          <>
            <p className="text-sm text-slate-300">{message}</p>
            <Button type="button" className="w-full" onClick={() => router.replace(AUTH_LINKS.dashboard)}>
              Go to dashboard
            </Button>
          </>
        )}
        {state === "error" && (
          <>
            <p className="text-sm text-red-300">{message}</p>
            <Link href={AUTH_LINKS.login}>
              <Button variant="outline" className="w-full">Sign in</Button>
            </Link>
          </>
        )}
      </div>
    </AuthLayout>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-navy-950"><div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /></div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
