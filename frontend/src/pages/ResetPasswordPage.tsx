import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AuthLayout from "@/components/auth/AuthLayout";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { authApi, getApiErrorMessage } from "@/lib/api";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/schemas/auth";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
    setSuccessMessage("");
    try {
      const { data } = await authApi.resetPassword(token, values.password);
      setSuccessMessage(data.message || "Your password has been reset successfully.");
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (error) {
      setServerError(getApiErrorMessage(error, "Unable to reset password. The link may have expired."));
    }
  };

  return (
    <AuthLayout
      title="Reset password"
      subtitle="Choose a new password for your account"
      footer={
        <>
          <Link to="/login" className="font-medium text-blue-400 hover:text-blue-300">
            Back to sign in
          </Link>
        </>
      }
    >
      {successMessage ? (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-slate-300">{successMessage}</p>
          <p className="text-xs text-slate-500">Redirecting to sign in…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {serverError && (
            <div
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              role="alert"
            >
              {serverError}
            </div>
          )}

          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            error={errors.password?.message}
            disabled={!token}
            {...register("password")}
          />

          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            error={errors.confirmPassword?.message}
            disabled={!token}
            {...register("confirmPassword")}
          />

          <Button type="submit" fullWidth isLoading={isSubmitting} disabled={!token}>
            Reset password
          </Button>

          {!token && (
            <Link to="/forgot-password" className="block text-center text-sm text-blue-400 hover:text-blue-300">
              Request a new reset link
            </Link>
          )}
        </form>
      )}
    </AuthLayout>
  );
}
