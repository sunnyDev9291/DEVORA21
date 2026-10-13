"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  saBtnGhost,
  saBtnPrimary,
  saField,
  saLabel,
  saMono,
  saTableWrap,
} from "@/components/super-admin/resume-dashboard-styles";
import { getApiErrorMessage } from "@/lib/auth-api";
import { AUTH_LINKS } from "@/lib/constants";
import { superAdminApi, type AdminUserSummary } from "@/lib/super-admin-api";

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

  const load = useCallback(
    async (nextPage: number, query: string) => {
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
    },
    [limit]
  );

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
    <div className="mt-8 space-y-4 sa-animate-in-delay-1">
      <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="sa-user-search" className={saLabel}>
            Search email or name
          </label>
          <input
            id="sa-user-search"
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            className={saField}
            placeholder="franco@…"
            spellCheck={false}
          />
        </div>
        <button type="submit" className={saBtnPrimary}>
          Search
        </button>
      </form>

      {error ? (
        <div
          className={`${saMono} sa-alert px-4 py-3 text-xs`}
          role="alert"
        >
          {error}
          <p className="mt-2 text-slate-500">
            Sign in to Devora21 with a super-admin account if you see 401/403. Backend must expose{" "}
            <code className="text-teal-700">GET /admin/users</code>.
          </p>
        </div>
      ) : null}

      <div className={`${saTableWrap} overflow-x-auto`}>
        <table className={`min-w-full text-left ${saMono} text-xs text-slate-600`}>
          <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-4 py-3.5 font-medium">Email</th>
              <th className="px-4 py-3.5 font-medium">Name</th>
              <th className="px-4 py-3.5 font-medium">Onboarded</th>
              <th className="px-4 py-3.5 font-medium">Resume</th>
              <th className="px-4 py-3.5 font-medium">Created</th>
              <th className="px-4 py-3.5 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  Loading users…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  No users found{q ? ` for “${q}”` : ""}.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-t border-slate-200">
                  <td className="px-4 py-3.5 text-slate-900">{user.email || "—"}</td>
                  <td className="px-4 py-3.5">{displayName(user)}</td>
                  <td className="px-4 py-3.5">{flagLabel(user.onboardingCompleted)}</td>
                  <td className="px-4 py-3.5">{flagLabel(user.resumeBuilderEnabled)}</td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link
                      href={`${AUTH_LINKS.superAdmin}/profiles/${encodeURIComponent(user.id)}`}
                      className="text-teal-700 underline-offset-4 transition-colors hover:text-teal-800 hover:underline"
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

      <div className={`flex flex-wrap items-center justify-between gap-3 ${saMono} text-[11px] text-slate-500`}>
        <p>
          {total} user{total === 1 ? "" : "s"} · page {page} / {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading || page <= 1}
            onClick={() => void load(page - 1, q)}
            className={`${saBtnGhost} h-8 px-3`}
          >
            Prev
          </button>
          <button
            type="button"
            disabled={loading || page >= totalPages}
            onClick={() => void load(page + 1, q)}
            className={`${saBtnGhost} h-8 px-3`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
