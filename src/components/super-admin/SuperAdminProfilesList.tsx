"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import SuperAdminProfileEditor from "@/components/super-admin/SuperAdminProfileEditor";
import {
  saBtnGhost,
  saBtnPrimary,
  saCard,
  saField,
  saLabel,
  saMono,
} from "@/components/super-admin/resume-dashboard-styles";
import { getApiErrorMessage } from "@/lib/auth-api";
import { superAdminApi, type AdminUserSummary } from "@/lib/super-admin-api";

function displayName(user: AdminUserSummary): string {
  return (
    user.name?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.email ||
    user.id
  );
}

export default function SuperAdminProfilesList() {
  const [q, setQ] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(
    async (nextPage: number, query: string, preferSelected?: string | null) => {
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

        const keep =
          preferSelected && result.users.some((u) => u.id === preferSelected)
            ? preferSelected
            : result.users[0]?.id ?? null;
        setSelectedId(keep);
      } catch (err) {
        setUsers([]);
        setTotal(0);
        setSelectedId(null);
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
    void load(1, next, selectedId);
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const selectedUser = users.find((u) => u.id === selectedId) ?? null;

  return (
    <div className="mt-8 flex min-h-[70vh] flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-5">
      {/* Left: profile name list */}
      <aside
        className={`${saCard} flex w-full shrink-0 flex-col overflow-hidden lg:w-[280px] xl:w-[320px]`}
      >
        <div className="border-b border-slate-100 p-4">
          <form onSubmit={handleSearch} className="space-y-2">
            <label htmlFor="sa-user-search" className={saLabel}>
              Profiles
            </label>
            <div className="flex gap-2">
              <input
                id="sa-user-search"
                value={draftQ}
                onChange={(e) => setDraftQ(e.target.value)}
                className={saField}
                placeholder="Search name or email…"
                spellCheck={false}
              />
              <button type="submit" className={`${saBtnPrimary} shrink-0 px-3`}>
                Go
              </button>
            </div>
          </form>
          <p className={`${saMono} mt-2 text-[11px] text-slate-400`}>
            {total} account{total === 1 ? "" : "s"}
            {loading ? " · loading…" : ""}
          </p>
        </div>

        {error ? (
          <div className={`${saMono} sa-alert m-3 px-3 py-2 text-[11px]`} role="alert">
            {error}
          </div>
        ) : null}

        <ul className="min-h-0 flex-1 overflow-y-auto py-1" role="listbox" aria-label="Profiles">
          {loading && users.length === 0 ? (
            <li className={`${saMono} px-4 py-8 text-center text-xs text-slate-400`}>
              Loading…
            </li>
          ) : users.length === 0 ? (
            <li className={`${saMono} px-4 py-8 text-center text-xs text-slate-400`}>
              No profiles{q ? ` for “${q}”` : ""}.
            </li>
          ) : (
            users.map((user) => {
              const active = user.id === selectedId;
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => setSelectedId(user.id)}
                    className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors ${
                      active
                        ? "bg-teal-50 text-slate-900"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`truncate text-sm font-medium ${
                        active ? "text-teal-900" : "text-slate-900"
                      }`}
                    >
                      {displayName(user)}
                    </span>
                    <span className={`${saMono} truncate text-[11px] text-slate-400`}>
                      {user.email || user.id}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        {totalPages > 1 ? (
          <div
            className={`flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 ${saMono} text-[11px] text-slate-500`}
          >
            <span>
              {page}/{totalPages}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => void load(page - 1, q, selectedId)}
                className={`${saBtnGhost} h-7 px-2`}
              >
                Prev
              </button>
              <button
                type="button"
                disabled={loading || page >= totalPages}
                onClick={() => void load(page + 1, q, selectedId)}
                className={`${saBtnGhost} h-7 px-2`}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </aside>

      {/* Right: profile detail */}
      <section className="min-w-0 flex-1">
        {selectedId ? (
          <div key={selectedId}>
            {selectedUser ? (
              <p className={`${saMono} mb-3 text-[11px] text-slate-400`}>
                Editing · {displayName(selectedUser)}
              </p>
            ) : null}
            <SuperAdminProfileEditor
              userId={selectedId}
              embedded
              onDeleted={() => {
                setSelectedId(null);
                void load(page, q, null);
              }}
            />
          </div>
        ) : (
          <div
            className={`${saCard} flex min-h-[320px] items-center justify-center p-8 text-center`}
          >
            <div>
              <p className="text-sm font-medium text-slate-800">Select a profile</p>
              <p className={`${saMono} mt-2 text-xs text-slate-400`}>
                Choose a name on the left to view and edit their information.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
