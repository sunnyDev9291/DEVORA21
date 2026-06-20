"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AuthLayout, { AuthFooterLink } from "@/components/auth/AuthLayout";
import GoogleOAuthSection from "@/components/auth/GoogleOAuthSection";
import AuthInput from "@/components/auth/AuthInput";
import Button from "@/components/ui/Button";
import { GuestGuard } from "@/components/auth/AuthGuard";
import { authApi } from "@/lib/auth-api";
import { getForgotPasswordErrorMessage, isGoogleAccountAuthError } from "@/lib/auth-password";
import { AUTH_LINKS } from "@/lib/constants";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/auth-schemas";

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState("");
  const [isGoogleAccount, setIsGoogleAccount] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setServerError("");
    setIsGoogleAccount(false);
    setSuccessMessage("");
    try {
      const { data } = await authApi.forgotPassword(values.email);
      setSuccessMessage(data.message || "If an account exists for that email, we've sent password reset instructions.");
    } catch (error) {
      setIsGoogleAccount(isGoogleAccountAuthError(error));
      setServerError(getForgotPasswordErrorMessage(error));
    }
  };

  return (
    <GuestGuard>
      <AuthLayout
        title="Forgot password?"
        subtitle="For email/password accounts only"
        footer={
          <>
            Remember your password? <AuthFooterLink href={AUTH_LINKS.login}>Back to sign in</AuthFooterLink>
          </>
        }
      >
        <div className="mb-6 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
          <p>
            Signed up with <span className="font-semibold text-white">Google</span>? You don&apos;t have a Devora21
            password. Use{" "}
            <Link href={AUTH_LINKS.login} className="font-semibold text-blue-200 underline underline-offset-2 hover:text-white">
              Sign in with Google
            </Link>{" "}
            on the login page instead.
          </p>
        </div>

        {successMessage ? (
          <div className="space-y-6 text-center">
            <p className="text-sm text-slate-300">{successMessage}</p>
            <p className="text-xs text-slate-500">
              If you use Google sign-in, ignore this email — reset links only work for email/password accounts.
            </p>
            <Link href={AUTH_LINKS.login}>
              <Button variant="outline" className="w-full">Return to sign in</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {serverError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
                {serverError}
                {isGoogleAccount && (
                  <p className="mt-3">
                    <Link href={AUTH_LINKS.login} className="font-semibold text-red-200 underline underline-offset-2 hover:text-white">
                      Go to Sign in with Google
                    </Link>
                  </p>
                )}
              </div>
            )}
            <AuthInput label="Email" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register("email")} />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}
      </AuthLayout>
    </GuestGuard>
  );
}
