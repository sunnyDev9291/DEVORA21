"use client";

import { Suspense, useState } from "react";
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
import { registerSchema, type RegisterFormValues } from "@/lib/auth-schemas";

function RegisterForm() {
  const { register: registerUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setServerError("");
    try {
      await registerUser(values.name, values.email, values.password);
      const next = getSafeRedirectPath(searchParams.get("next"));
      router.replace(next);
    } catch (error) {
      setServerError(getApiErrorMessage(error, "Registration failed. Please try again."));
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Get started with Devora21 in seconds"
      footer={
        <>
          Already have an account? <AuthFooterLink href={AUTH_LINKS.login}>Sign in</AuthFooterLink>
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
        <AuthInput label="Full name" type="text" autoComplete="name" placeholder="Jane Doe" error={errors.name?.message} {...register("name")} />
        <AuthInput label="Email" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register("email")} />
        <AuthInput label="Password" type="password" autoComplete="new-password" placeholder="At least 8 characters" error={errors.password?.message} {...register("password")} />
        <AuthInput label="Confirm password" type="password" autoComplete="new-password" placeholder="Repeat your password" error={errors.confirmPassword?.message} {...register("confirmPassword")} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function RegisterPage() {
  return (
    <GuestGuard>
      <Suspense
        fallback={
          <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-navy-950">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        }
      >
        <RegisterForm />
      </Suspense>
    </GuestGuard>
  );
}
