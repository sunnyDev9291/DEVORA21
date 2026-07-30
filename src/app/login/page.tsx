"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AuthLayout, { AuthDivider, AuthFooterLink } from "@/components/auth/AuthLayout";
import GoogleOAuthSection from "@/components/auth/GoogleOAuthSection";
import AuthInput from "@/components/auth/AuthInput";
import Button from "@/components/ui/Button";
import { GuestGuard } from "@/components/auth/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import { getLoginErrorMessage, isGoogleAccountAuthError } from "@/lib/auth-password";
import { getApiKeyAuthRedirectPath, getPostAuthRedirectPath } from "@/lib/auth-redirect";
import { getApiErrorMessage } from "@/lib/auth-api";
import { AUTH_LINKS } from "@/lib/constants";
import { loginSchema, type LoginFormValues } from "@/lib/auth-schemas";

function LoginForm() {
  const { login, connectWithApiKey } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState("");
  const [isGoogleAccount, setIsGoogleAccount] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyError, setApiKeyError] = useState("");
  const [connectingKey, setConnectingKey] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: true },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError("");
    setApiKeyError("");
    setIsGoogleAccount(false);
    try {
      const user = await login(values.email, values.password, values.rememberMe ?? true);
      router.replace(getPostAuthRedirectPath(user, searchParams.get("next")));
    } catch (error) {
      setIsGoogleAccount(isGoogleAccountAuthError(error));
      setServerError(getLoginErrorMessage(error));
    }
  };

  async function onConnectApiKey(e: React.FormEvent) {
    e.preventDefault();
    if (connectingKey) return;
    setApiKeyError("");
    setServerError("");
    setConnectingKey(true);
    try {
      const user = await connectWithApiKey(apiKey);
      router.replace(getApiKeyAuthRedirectPath(user, searchParams.get("next")));
    } catch (error) {
      setApiKeyError(getApiErrorMessage(error, "Could not connect with that API key."));
    } finally {
      setConnectingKey(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in with Google, email, or a dv21_ API key"
      footer={
        <>
          Don&apos;t have an account? <AuthFooterLink href={AUTH_LINKS.register}>Create one</AuthFooterLink>
        </>
      }
    >
      <GoogleOAuthSection mode="login" page="login" />
      <AuthDivider />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
            {serverError}
            {isGoogleAccount && (
              <p className="mt-2 text-xs text-red-200">
                Use the <span className="font-semibold">Sign in with Google</span> button above.
              </p>
            )}
          </div>
        )}
        <AuthInput label="Email" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register("email")} />
        <AuthInput label="Password" type="password" autoComplete="current-password" placeholder="••••••••" error={errors.password?.message} {...register("password")} />
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-white/20 bg-navy-900 text-blue-500 focus:ring-blue-500/40"
            {...register("rememberMe")}
          />
          <span className="text-sm text-slate-300">
            Keep me signed in for 30 days
            <span className="mt-0.5 block text-xs text-slate-500">Recommended on your personal device</span>
          </span>
        </label>
        <div className="flex justify-end">
          <Link href={AUTH_LINKS.forgotPassword} className="text-sm text-blue-400 hover:text-blue-300">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting || connectingKey}>
          {isSubmitting ? "Signing in…" : "Sign in with email"}
        </Button>
      </form>

      <AuthDivider />

      <form onSubmit={onConnectApiKey} className="space-y-4" noValidate>
        <div>
          <p className="text-sm font-medium text-slate-200">Continue with API key</p>
          <p className="mt-1 text-xs text-slate-500">
            Use a <span className="font-mono text-slate-400">dv21_</span> key from your dashboard for job scrape and resume
            generation without email login. Requires resume builder access.
          </p>
        </div>
        {apiKeyError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
            {apiKeyError}
          </div>
        )}
        <AuthInput
          label="API key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="dv21_…"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          error={undefined}
        />
        <Button type="submit" className="w-full" disabled={connectingKey || isSubmitting || !apiKey.trim()}>
          {connectingKey ? "Connecting…" : "Connect API key"}
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
