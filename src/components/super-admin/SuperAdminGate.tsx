"use client";

import Link from "next/link";
import { FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import SuperAdminGatewayCredentialsForm from "@/components/super-admin/SuperAdminGatewayCredentialsForm";
import {
  saAlert,
  saBtnPrimary,
  saDisplay,
  saEyebrow,
  saField,
  saLabel,
  saMono,
} from "@/components/super-admin/resume-dashboard-styles";
import { useAuth } from "@/context/AuthContext";
import { AUTH_LINKS } from "@/lib/constants";
import { ApiError, getApiErrorMessage } from "@/lib/auth-api";
import {
  superAdminGatewayApi,
  type SuperAdminGatewayStatus,
} from "@/lib/super-admin-gateway-api";
import {
  isTempSuperAdminAuthed,
  setTempSuperAdminAuthed,
} from "@/lib/super-admin-temp-auth";

function GateShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="sa-glass sa-animate-in p-7 sm:p-9">
        <div className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
          <p className={saEyebrow}>Control plane · auth</p>
        </div>
        <h1 className={`${saDisplay} mt-3 text-3xl font-extrabold tracking-tight text-slate-900`}>
          {title}
        </h1>
        {children}
        <Link
          href={AUTH_LINKS.dashboard}
          className={`${saMono} mt-6 inline-flex text-[11px] text-slate-500 underline-offset-4 transition-colors hover:text-teal-700 hover:underline`}
        >
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function SuperAdminLogin({
  userId,
  status,
  onSuccess,
}: {
  userId: string;
  status: SuperAdminGatewayStatus;
  onSuccess: () => void;
}) {
  const [username, setUsername] = useState(status.username || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await superAdminGatewayApi.verify(userId, username, password);
      setTempSuperAdminAuthed(true);
      onSuccess();
    } catch (err) {
      setError(getApiErrorMessage(err, (err as ApiError)?.message || "Invalid username or password."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <GateShell title="Super Admin">
      <p className={`${saMono} mt-3 text-xs leading-relaxed text-slate-500`}>
        Your personal operator gateway. Not your main Devora21 password. Admin APIs still require a
        signed-in session with the super-admin role.
        {status.localFallback ? (
          <>
            {" "}
            <span className="text-amber-700">
              Using browser storage until the gateway API is deployed.
            </span>
          </>
        ) : null}
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-7 space-y-4">
        <div>
          <label htmlFor="sa-username" className={saLabel}>
            Username
          </label>
          <input
            id="sa-username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={saField}
            spellCheck={false}
          />
        </div>
        <div>
          <label htmlFor="sa-password" className={saLabel}>
            Password
          </label>
          <input
            id="sa-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={saField}
          />
        </div>

        {error ? (
          <p className={`${saAlert} ${saMono} px-3 py-2.5 text-xs`} role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className={`${saBtnPrimary} w-full disabled:opacity-60`}
        >
          {submitting ? "Checking…" : "Enter console"}
        </button>
      </form>
    </GateShell>
  );
}

function SuperAdminSetup({
  userId,
  onReady,
}: {
  userId: string;
  onReady: (status: SuperAdminGatewayStatus) => void;
}) {
  return (
    <GateShell title="Set gateway access">
      <p className={`${saMono} mt-3 text-xs leading-relaxed text-slate-500`}>
        Create your own Super Admin gateway username and password. Only you unlock this console —
        separate from your Devora21 login.
      </p>
      <div className="mt-7">
        <SuperAdminGatewayCredentialsForm
          userId={userId}
          mode="setup"
          onSaved={(status) => {
            setTempSuperAdminAuthed(true);
            onReady(status);
          }}
          submitLabel="Save and enter console"
        />
      </div>
    </GateShell>
  );
}

export function SuperAdminGate({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [status, setStatus] = useState<SuperAdminGatewayStatus | null>(null);
  const [loadError, setLoadError] = useState("");

  const refreshStatus = useCallback(async (userId: string) => {
    const next = await superAdminGatewayApi.getStatus(userId);
    setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    (async () => {
      setLoadError("");
      if (!user?.id) {
        if (!cancelled) {
          setStatus(null);
          setAuthed(false);
          setReady(true);
        }
        return;
      }

      try {
        const next = await refreshStatus(user.id);
        if (cancelled) return;
        setAuthed(isTempSuperAdminAuthed());
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          getApiErrorMessage(err, "Could not load gateway credentials. Sign in and try again.")
        );
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, refreshStatus]);

  if (authLoading || !ready) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-teal-600/20 border-t-teal-600" />
      </div>
    );
  }

  if (!user?.id) {
    return (
      <GateShell title="Super Admin">
        <p className={`${saMono} mt-3 text-xs leading-relaxed text-slate-500`}>
          Sign in to Devora21 with a super-admin account first, then return here to unlock the
          operator gateway.
        </p>
        <Link href={AUTH_LINKS.login} className={`${saBtnPrimary} mt-7 inline-flex w-full justify-center`}>
          Sign in
        </Link>
      </GateShell>
    );
  }

  if (loadError) {
    return (
      <GateShell title="Super Admin">
        <p className={`${saAlert} ${saMono} mt-5 px-3 py-2.5 text-xs`} role="alert">
          {loadError}
        </p>
      </GateShell>
    );
  }

  if (!status?.configured) {
    return (
      <SuperAdminSetup
        userId={user.id}
        onReady={(next) => {
          setStatus(next);
          setAuthed(true);
        }}
      />
    );
  }

  if (!authed) {
    return (
      <SuperAdminLogin
        userId={user.id}
        status={status}
        onSuccess={() => setAuthed(true)}
      />
    );
  }

  return <div className="sa-animate-in">{children}</div>;
}

export function lockSuperAdminSession(): void {
  setTempSuperAdminAuthed(false);
}
