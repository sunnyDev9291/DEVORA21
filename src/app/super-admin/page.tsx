"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AUTH_LINKS } from "@/lib/constants";
import {
  isTempSuperAdminAuthed,
  setTempSuperAdminAuthed,
  verifyTempSuperAdminCredentials,
} from "@/lib/super-admin-temp-auth";

const fieldClass =
  "w-full border border-[#2a3a4a] bg-[#0d141c] px-3 py-2.5 font-[family-name:var(--font-sa-mono)] text-sm text-[#f4f7fb] outline-none placeholder:text-[#5a6b7c] focus:border-teal-400/50";

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
      <div className="border border-[#1e2a36] bg-[#101820] p-6 sm:p-8">
        <p className="font-[family-name:var(--font-sa-mono)] text-[11px] font-medium uppercase tracking-[0.22em] text-teal-300/80">
          Control plane · auth
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-sa-display)] text-2xl font-extrabold tracking-tight text-[#f4f7fb]">
          Super Admin
        </h1>
        <p className="mt-2 font-[family-name:var(--font-sa-mono)] text-xs leading-relaxed text-[#8b9aab]">
          Temporary operator login. Not the main app account.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="sa-username"
              className="mb-1.5 block font-[family-name:var(--font-sa-mono)] text-[10px] uppercase tracking-[0.16em] text-[#6b7c8f]"
            >
              Username
            </label>
            <input
              id="sa-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={fieldClass}
              spellCheck={false}
            />
          </div>
          <div>
            <label
              htmlFor="sa-password"
              className="mb-1.5 block font-[family-name:var(--font-sa-mono)] text-[10px] uppercase tracking-[0.16em] text-[#6b7c8f]"
            >
              Password
            </label>
            <input
              id="sa-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldClass}
            />
          </div>

          {error ? (
            <p
              className="border border-red-500/30 bg-red-500/10 px-3 py-2 font-[family-name:var(--font-sa-mono)] text-xs text-red-300"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center border border-teal-400/40 bg-teal-400/10 font-[family-name:var(--font-sa-mono)] text-xs font-semibold uppercase tracking-wider text-teal-100 transition-colors hover:border-teal-300/60 hover:bg-teal-400/15"
          >
            Enter
          </button>
        </form>

        <Link
          href={AUTH_LINKS.dashboard}
          className="mt-5 inline-flex font-[family-name:var(--font-sa-mono)] text-[11px] text-[#6b7c8f] underline-offset-2 hover:text-teal-200 hover:underline"
        >
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function SuperAdminConsole({ onLock }: { onLock: () => void }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-4 border-b border-teal-400/20 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-[family-name:var(--font-sa-mono)] text-[11px] font-medium uppercase tracking-[0.22em] text-teal-300/80">
            Control plane · v0
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-sa-display)] text-3xl font-extrabold tracking-tight text-[#f4f7fb] sm:text-4xl">
            Super Admin
          </h1>
          <p className="mt-2 max-w-xl font-[family-name:var(--font-sa-mono)] text-sm leading-relaxed text-[#8b9aab]">
            Separate ops surface — not the product UI. Tools will land here next.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onLock}
            className="inline-flex h-10 items-center justify-center border border-[#2a3a4a] bg-[#101820] px-4 font-[family-name:var(--font-sa-mono)] text-xs font-semibold uppercase tracking-wider text-[#9aabbc] transition-colors hover:border-teal-400/30 hover:text-teal-200"
          >
            Lock
          </button>
          <Link
            href={AUTH_LINKS.dashboard}
            className="inline-flex h-10 items-center justify-center border border-teal-400/30 bg-teal-400/5 px-4 font-[family-name:var(--font-sa-mono)] text-xs font-semibold uppercase tracking-wider text-teal-200 transition-colors hover:border-teal-300/50 hover:bg-teal-400/10"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="border border-[#1e2a36] bg-[#101820] p-5">
          <p className="font-[family-name:var(--font-sa-mono)] text-[10px] uppercase tracking-[0.18em] text-teal-400/70">
            Operator
          </p>
          <p className="mt-3 font-[family-name:var(--font-sa-mono)] text-sm text-[#f4f7fb]">
            Temporary credentials · session only
          </p>
          <p className="mt-1 font-[family-name:var(--font-sa-mono)] text-xs text-[#6b7c8f]">
            Cleared when the tab session ends or you hit Lock
          </p>
        </div>

        <div className="border border-dashed border-[#2a3a4a] bg-[#0d141c] p-5">
          <p className="font-[family-name:var(--font-sa-mono)] text-[10px] uppercase tracking-[0.18em] text-[#6b7c8f]">
            Modules
          </p>
          <p className="mt-3 font-[family-name:var(--font-sa-display)] text-lg font-bold text-[#c5d0dc]">
            Empty bay
          </p>
          <p className="mt-1 font-[family-name:var(--font-sa-mono)] text-xs leading-relaxed text-[#6b7c8f]">
            Placeholder. Admin actions will be wired here after the shell.
          </p>
        </div>
      </section>
    </div>
  );
}

export default function SuperAdminPage() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(isTempSuperAdminAuthed());
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-400/40 border-t-teal-300" />
      </div>
    );
  }

  if (!authed) {
    return <SuperAdminLogin onSuccess={() => setAuthed(true)} />;
  }

  return (
    <SuperAdminConsole
      onLock={() => {
        setTempSuperAdminAuthed(false);
        setAuthed(false);
      }}
    />
  );
}
