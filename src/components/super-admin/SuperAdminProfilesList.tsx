"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { getApiErrorMessage } from "@/lib/auth-api";
import { AUTH_LINKS } from "@/lib/constants";
import {
  superAdminApi,
  type AdminUserSummary,
} from "@/lib/super-admin-api";

const fieldClass =
  "w-full border border-[#2a3a4a] bg-[#0d141c] px-3 py-2.5 font-[family-name:var(--font-sa-mono)] text-sm text-[#f4f7fb] outline-none placeholder:text-[#5a6b7c] focus:border-teal-400/50";

function flagLabel(value: boolean | undefined): string {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "—";
}

function displayName(user: AdminUserSummary): string {
  return (
    user.name?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    "—"
  );
}

export default function SuperAdminProfilesList() {
  const [q, setQ] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (nextPage: number, query: string) => {
    setLoading(true);
    setError("");
    try {
      const result = await superAdminApi.listUsers({
        q: query,
        page: nextPage,
        limit,
      });
      setUsers(result.users);
      setTotal(result.total);
      setPage(result.page);
    } catch (err) {
      setUsers([]);
      setTotal(0);
      setError(getApiErrorMessage(err, "Could not load users."));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void load(1, "");
  }, [load]);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const next = draftQ.trim();
    setQ(next);
    void load(1, next);
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="mt-8 space-y-4">
      <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label
            htmlFor="sa-user-search"
            className="mb-1.5 block font-[family-name:var(--font-sa-mono)] text-[10px] uppercase tracking-[0.16em] text-[#6b7c8f]"
          >
            Search email or name
          </label>
          <input
            id="sa-user-search"
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            className={fieldClass}
            placeholder="franco@…"
            spellCheck={false}
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center border border-teal-400/40 bg-teal-400/10 px-4 font-[family-name:var(--font-sa-mono)] text-xs font-semibold uppercase tracking-wider text-teal-100 transition-colors hover:border-teal-300/60 hover:bg-teal-400/15"
        >
          Search
        </button>
      </form>

      {error ? (
        <div
          className="border border-red-500/30 bg-red-500/10 px-4 py-3 font-[family-name:var(--font-sa-mono)] text-xs text-red-300"
          role="alert"
        >
          {error}
          <p className="mt-2 text-[#8b9aab]">
            Sign in to Devora21 with a super-admin account if you see 401/403. Backend must expose{" "}
            <code className="text-teal-200/80">GET /admin/users</code>.
          </p>
        </div>
      ) : null}

      <div className="overflow-x-auto border border-[#1e2a36] bg-[#101820]">
        <table className="min-w-full text-left font-[family-name:var(--font-sa-mono)] text-xs text-[#c5d0dc]">
          <thead className="border-b border-[#1e2a36] text-[10px] uppercase tracking-[0.14em] text-[#6b7c8f]">
            <tr>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Onboarded</th>
              <th className="px-4 py-3 font-medium">Resume</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#6b7c8f]">
                  Loading users…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#6b7c8f]">
                  No users found{q ? ` for “${q}”` : ""}.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-t border-[#1e2a36] hover:bg-[#0d141c]/60">
                  <td className="px-4 py-3 text-[#f4f7fb]">{user.email || "—"}</td>
                  <td className="px-4 py-3">{displayName(user)}</td>
                  <td className="px-4 py-3">{flagLabel(user.onboardingCompleted)}</td>
                  <td className="px-4 py-3">{flagLabel(user.resumeBuilderEnabled)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`${AUTH_LINKS.superAdmin}/profiles/${encodeURIComponent(user.id)}`}
                      className="text-teal-300 underline-offset-2 hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 font-[family-name:var(--font-sa-mono)] text-[11px] text-[#6b7c8f]">
        <p>
          {total} user{total === 1 ? "" : "s"} · page {page} / {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading || page <= 1}
            onClick={() => void load(page - 1, q)}
            className="border border-[#2a3a4a] px-3 py-1.5 uppercase tracking-wider text-[#9aabbc] disabled:opacity-40 hover:border-teal-400/30 hover:text-teal-200"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={loading || page >= totalPages}
            onClick={() => void load(page + 1, q)}
            className="border border-[#2a3a4a] px-3 py-1.5 uppercase tracking-wider text-[#9aabbc] disabled:opacity-40 hover:border-teal-400/30 hover:text-teal-200"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
