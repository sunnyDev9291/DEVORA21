import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AuthLayout from "@/components/auth/AuthLayout";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { authApi, getApiErrorMessage } from "@/lib/api";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/schemas/auth";

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
      setSuccessMessage(
        data.message ||
          "If an account exists for that email, we've sent password reset instructions.",
      );
    } catch (error) {
      setServerError(getApiErrorMessage(error, "Unable to send reset email. Please try again."));
    }
  };

  return (
    <AuthLayout
      title="Forgot password?"
      subtitle="Enter your email and we'll send you a reset link"
      footer={
        <>
          Remember your password?{" "}
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
          <Link to="/login">
            <Button variant="outline" fullWidth>
              Return to sign in
            </Button>
          </Link>
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
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            {...register("email")}
          />

          <Button type="submit" fullWidth isLoading={isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
