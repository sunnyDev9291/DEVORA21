"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import AuthLayout, { AuthDivider, AuthFooterLink } from "@/components/auth/AuthLayout";
import GoogleOAuthSection from "@/components/auth/GoogleOAuthSection";
import RegisterSignedInBanner from "@/components/auth/RegisterSignedInBanner";
import { RegisterPageGuard } from "@/components/auth/AuthGuard";
import AuthInput from "@/components/auth/AuthInput";
import Button from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import {
  getRegisterErrorMessage,
  isDuplicateEmailRegisterError,
  isValidAuthUser,
} from "@/lib/auth-api";
import { getPostAuthRedirectPath } from "@/lib/auth-redirect";
import { AUTH_LINKS } from "@/lib/constants";
import { registerSchema, type RegisterFormValues } from "@/lib/auth-schemas";

function RegisterEmailForm() {
  const { register: registerUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState("");
  const [duplicateEmail, setDuplicateEmail] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setServerError("");
    setDuplicateEmail(false);
    try {
      const user = await registerUser(values.name, values.email, values.password);
      router.replace(getPostAuthRedirectPath(user, searchParams.get("next")));
    } catch (error) {
      const duplicate = isDuplicateEmailRegisterError(error);
      const message = getRegisterErrorMessage(error);
      setDuplicateEmail(duplicate);
      setServerError(message);
      if (duplicate) {
        setError("email", { type: "server", message });
      }
    }
  };

  return (
    <>
      <AuthDivider label="or sign up with email instead" />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
            {serverError}
            {duplicateEmail ? (
              <p className="mt-2">
                <Link href={AUTH_LINKS.login} className="font-semibold text-red-200 underline underline-offset-2 hover:text-white">
                  Sign in with this email
                </Link>
              </p>
            ) : null}
          </div>
        )}
        <AuthInput label="Full name" type="text" autoComplete="name" placeholder="Jane Doe" error={errors.name?.message} {...register("name")} />
        <AuthInput label="Email" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register("email")} />
        <AuthInput label="Password" type="password" autoComplete="new-password" placeholder="At least 8 characters" error={errors.password?.message} {...register("password")} />
        <AuthInput label="Confirm password" type="password" autoComplete="new-password" placeholder="Repeat your password" error={errors.confirmPassword?.message} {...register("confirmPassword")} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account with email"}
        </Button>
      </form>
    </>
  );
}

function RegisterPageContent() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-navy-950">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Sign up with Google, or use email below"
      footer={
        <>
          Already have an account? <AuthFooterLink href={AUTH_LINKS.login}>Sign in</AuthFooterLink>
        </>
      }
    >
      <GoogleOAuthSection mode="signup" page="register" />

      {isAuthenticated && isValidAuthUser(user) && <RegisterSignedInBanner user={user} />}

      {!isAuthenticated && (
        <Suspense
          fallback={
            <div className="mt-6 h-32 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]" aria-hidden />
          }
        >
          <RegisterEmailForm />
        </Suspense>
      )}
    </AuthLayout>
  );
}

export default function RegisterPage() {
  return (
    <RegisterPageGuard>
      <RegisterPageContent />
    </RegisterPageGuard>
  );
}
