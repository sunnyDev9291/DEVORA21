"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AuthLayout, { AuthDivider, AuthFooterLink } from "@/components/auth/AuthLayout";
import OAuthButtons from "@/components/auth/OAuthButtons";
import AuthInput from "@/components/auth/AuthInput";
import Button from "@/components/ui/Button";
import { GuestGuard } from "@/components/auth/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/lib/auth-api";
import { getSafeRedirectPath } from "@/lib/auth-redirect";
import { AUTH_LINKS } from "@/lib/constants";
import { loginSchema, type LoginFormValues } from "@/lib/auth-schemas";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError("");
    try {
      await login(values.email, values.password);
      const next = getSafeRedirectPath(searchParams.get("next"));
      router.replace(next);
    } catch (error) {
      setServerError(getApiErrorMessage(error, "Login failed. Please try again."));
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your Devora21 account"
      footer={
        <>
          Don&apos;t have an account? <AuthFooterLink href={AUTH_LINKS.register}>Create one</AuthFooterLink>
        </>
      }
    >
      <OAuthButtons />
      <AuthDivider />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
            {serverError}
          </div>
        )}
        <AuthInput label="Email" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register("email")} />
        <AuthInput label="Password" type="password" autoComplete="current-password" placeholder="••••••••" error={errors.password?.message} {...register("password")} />
        <div className="flex justify-end">
          <Link href={AUTH_LINKS.forgotPassword} className="text-sm text-blue-400 hover:text-blue-300">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <GuestGuard>
      <Suspense
        fallback={
          <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-navy-950">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </GuestGuard>
  );
}
