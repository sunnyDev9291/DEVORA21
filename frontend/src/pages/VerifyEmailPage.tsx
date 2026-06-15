import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AuthLayout from "@/components/auth/AuthLayout";
import Button from "@/components/ui/Button";
import { authApi, getApiErrorMessage } from "@/lib/api";

type VerifyState = "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [state, setState] = useState<VerifyState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("Invalid or missing verification token.");
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        const { data } = await authApi.verifyEmail(token);
        if (!cancelled) {
          setState("success");
          setMessage(data.message || "Your email has been verified successfully.");
        }
      } catch (error) {
        if (!cancelled) {
          setState("error");
          setMessage(getApiErrorMessage(error, "Email verification failed. The link may have expired."));
        }
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthLayout
      title="Verify email"
      subtitle={
        state === "loading"
          ? "Confirming your email address…"
          : state === "success"
            ? "You're all set"
            : "Verification failed"
      }
    >
      <div className="space-y-6 text-center">
        {state === "loading" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <p className="text-sm text-slate-400">Please wait…</p>
          </div>
        )}

        {state === "success" && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-slate-300">{message}</p>
            <Link to="/dashboard">
              <Button fullWidth>Go to dashboard</Button>
            </Link>
          </>
        )}

        {state === "error" && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-400">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-sm text-red-300">{message}</p>
            <div className="flex flex-col gap-3">
              <Link to="/login">
                <Button variant="outline" fullWidth>
                  Sign in
                </Button>
              </Link>
              <Link to="/register" className="text-sm text-blue-400 hover:text-blue-300">
                Create a new account
              </Link>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
