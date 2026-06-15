"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AuthLayout, { AuthFooterLink } from "@/components/auth/AuthLayout";
import AuthInput from "@/components/auth/AuthInput";
import Button from "@/components/ui/Button";
import { authApi, getApiErrorMessage } from "@/lib/auth-api";
import { AUTH_LINKS } from "@/lib/constants";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/lib/auth-schemas";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!token) {
      setServerError("Invalid or missing reset token. Please request a new reset link.");
    }
  }, [token]);

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!token) return;
    setServerError("");
    try {
      const { data } = await authApi.resetPassword(token, values.password);
      setSuccessMessage(data.message || "Your password has been reset successfully.");
      setTimeout(() => router.replace(AUTH_LINKS.login), 2500);
    } catch (error) {
      setServerError(getApiErrorMessage(error, "Unable to reset password. The link may have expired."));
    }
  };

  return (
    <AuthLayout
      title="Reset password"
      subtitle="Choose a new password for your account"
      footer={<AuthFooterLink href={AUTH_LINKS.login}>Back to sign in</AuthFooterLink>}
    >
      {successMessage ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-slate-300">{successMessage}</p>
          <p className="text-xs text-slate-500">Redirecting to sign in…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {serverError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
              {serverError}
            </div>
          )}
          <AuthInput label="New password" type="password" autoComplete="new-password" disabled={!token} error={errors.password?.message} {...register("password")} />
          <AuthInput label="Confirm new password" type="password" autoComplete="new-password" disabled={!token} error={errors.confirmPassword?.message} {...register("confirmPassword")} />
          <Button type="submit" className="w-full" disabled={!token || isSubmitting}>
            {isSubmitting ? "Resetting…" : "Reset password"}
          </Button>
          {!token && (
            <Link href={AUTH_LINKS.forgotPassword} className="block text-center text-sm text-blue-400 hover:text-blue-300">
              Request a new reset link
            </Link>
          )}
        </form>
      )}
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-navy-950"><div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
