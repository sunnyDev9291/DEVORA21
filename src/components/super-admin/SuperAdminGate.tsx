"use client";

import Link from "next/link";
import { FormEvent, type ReactNode, useEffect, useState } from "react";
import { AUTH_LINKS } from "@/lib/constants";
import {
  saAlert,
  saBtnPrimary,
  saDisplay,
  saEyebrow,
  saField,
  saLabel,
  saMono,
} from "@/components/super-admin/resume-dashboard-styles";
import {
  isTempSuperAdminAuthed,
  setTempSuperAdminAuthed,
  verifyTempSuperAdminCredentials,
} from "@/lib/super-admin-temp-auth";

function SuperAdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!verifyTempSuperAdminCredentials(username, password)) {
      setError("Invalid username or password.");
      return;
    }
    setTempSuperAdminAuthed(true);
    setError("");
    onSuccess();
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="sa-glass sa-animate-in p-7 sm:p-9">
        <div className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
          <p className={saEyebrow}>Control plane · auth</p>
        </div>
        <h1 className={`${saDisplay} mt-3 text-3xl font-extrabold tracking-tight text-slate-900`}>
          Super Admin
        </h1>
        <p className={`${saMono} mt-3 text-xs leading-relaxed text-slate-500`}>
          Temporary operator login. Not the main app account. Admin APIs still require a signed-in
          Devora21 session with super-admin role.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
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

          <button type="submit" className={`${saBtnPrimary} w-full`}>
            Enter console
          </button>
        </form>

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

export function SuperAdminGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(isTempSuperAdminAuthed());
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-teal-600/20 border-t-teal-600" />
      </div>
    );
  }

  if (!authed) {
    return <SuperAdminLogin onSuccess={() => setAuthed(true)} />;
  }

  return <div className="sa-animate-in">{children}</div>;
}

export function lockSuperAdminSession(): void {
  setTempSuperAdminAuthed(false);
}
