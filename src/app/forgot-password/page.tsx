"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AuthLayout, { AuthFooterLink } from "@/components/auth/AuthLayout";
import AuthInput from "@/components/auth/AuthInput";
import Button from "@/components/ui/Button";
import { GuestGuard } from "@/components/auth/AuthGuard";
import { authApi, getApiErrorMessage } from "@/lib/auth-api";
import { AUTH_LINKS } from "@/lib/constants";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/auth-schemas";

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState("");
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
    setSuccessMessage("");
    try {
      const { data } = await authApi.forgotPassword(values.email);
      setSuccessMessage(data.message || "If an account exists for that email, we've sent password reset instructions.");
    } catch (error) {
      setServerError(getApiErrorMessage(error, "Unable to send reset email. Please try again."));
    }
  };

  return (
    <GuestGuard>
      <AuthLayout
        title="Forgot password?"
        subtitle="Enter your email and we'll send you a reset link"
        footer={
          <>
            Remember your password? <AuthFooterLink href={AUTH_LINKS.login}>Back to sign in</AuthFooterLink>
          </>
        }
      >
        {successMessage ? (
          <div className="space-y-6 text-center">
            <p className="text-sm text-slate-300">{successMessage}</p>
            <Link href={AUTH_LINKS.login}>
              <Button variant="outline" className="w-full">Return to sign in</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {serverError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
                {serverError}
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
