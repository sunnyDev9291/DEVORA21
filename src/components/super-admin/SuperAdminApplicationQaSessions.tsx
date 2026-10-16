"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  saAlert,
  saBtnGhost,
  saBtnPrimary,
  saCard,
  saChip,
  saChipActive,
  saField,
  saLabel,
  saMono,
  saTableWrap,
} from "@/components/super-admin/resume-dashboard-styles";
import { AUTH_LINKS } from "@/lib/constants";
import { getApiErrorMessage } from "@/lib/auth-api";
import { formatEstDateTime, formatEstDateTimeParts } from "@/lib/format-est-datetime";
import {
  displayApplicationQaOwnerName,
  superAdminApplicationQaApi,
  type ApplicationQaSessionSummary,
} from "@/lib/super-admin-application-qa-api";

type SuperAdminApplicationQaSessionsProps = {
  initialUserId?: string;
  initialQ?: string;
};

function statusClass(status: string): string {
  return status === "recording" ? saChipActive : saChip;
}

export default function SuperAdminApplicationQaSessions({
  initialUserId = "",
  initialQ = "",
}: SuperAdminApplicationQaSessionsProps) {
  const router = useRouter();
  const [userId, setUserId] = useState(initialUserId);
  const [draftQ, setDraftQ] = useState(initialQ);
  const [q, setQ] = useState(initialQ);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0);
  const [sessions, setSessions] = useState<ApplicationQaSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [toast, setToast] = useState("");

  const load = useCallback(
    async (nextPage: number, nextUserId: string, nextQ: string) => {
      setLoading(true);
      setError("");
      try {
        const result = await superAdminApplicationQaApi.listSessions({
          userId: nextUserId || undefined,
          q: nextQ || undefined,
          page: nextPage,
          limit,
        });
        setSessions(result.sessions);
        setTotal(result.total);
        setPage(result.page);
      } catch (err) {
        setSessions([]);
        setTotal(0);
        setError(getApiErrorMessage(err, "Could not load sessions."));
      } finally {
        setLoading(false);
      }
    },
    [limit]
  );

  useEffect(() => {
    setUserId(initialUserId);
    setDraftQ(initialQ);
    setQ(initialQ);
    void load(1, initialUserId, initialQ);
  }, [load, initialUserId, initialQ]);

  function syncUrl(nextUserId: string, nextQ: string) {
    const params = new URLSearchParams();
    if (nextUserId.trim()) params.set("userId", nextUserId.trim());
    if (nextQ.trim()) params.set("q", nextQ.trim());
    const query = params.toString();
    router.replace(
      `${AUTH_LINKS.superAdmin}/application-qa/sessions${query ? `?${query}` : ""}`
    );
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const nextQ = draftQ.trim();
    setQ(nextQ);
    syncUrl(userId, nextQ);
    void load(1, userId, nextQ);
  }

  function clearOwnerFilter() {
    setUserId("");
    syncUrl("", q);
    void load(1, "", q);
  }

  async function handleDelete(session: ApplicationQaSessionSummary) {
    const label = session.pageTitle || session.tabUrl || session.id;
    if (!window.confirm(`Delete session “${label}”? This cannot be undone.`)) return;

    setDeletingId(session.id);
    setToast("");
    try {
      await superAdminApplicationQaApi.deleteSession(session.id);
      setToast("Session deleted.");
      const nextTotal = Math.max(0, total - 1);
      const nextPage =
        sessions.length <= 1 && page > 1 ? page - 1 : page;
      setTotal(nextTotal);
      await load(nextPage, userId, q);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not delete session."));
    } finally {
      setDeletingId("");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="mt-8 space-y-4">
      <form onSubmit={handleSearch} className={`${saCard} space-y-3 p-4 sm:p-5`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="sa-aqa-search" className={saLabel}>
              Search sessions
            </label>
            <input
              id="sa-aqa-search"
              value={draftQ}
              onChange={(e) => setDraftQ(e.target.value)}
              className={saField}
              placeholder="URL, page title, or owner email…"
              spellCheck={false}
            />
          </div>
          <button type="submit" className={`${saBtnPrimary} shrink-0`}>
            Search
          </button>
        </div>
        {userId ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className={saChipActive}>Owner filter · {userId.slice(0, 8)}…</span>
            <button type="button" onClick={clearOwnerFilter} className={saBtnGhost}>
              Clear owner
            </button>
          </div>
        ) : null}
      </form>

      {toast ? (
        <p className={`${saMono} rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-xs text-teal-800`} role="status">
          {toast}
        </p>
      ) : null}

      {error ? (
        <p className={`${saAlert} ${saMono} px-4 py-3 text-xs`} role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`${saMono} text-[11px] text-slate-400`}>
          {total} session{total === 1 ? "" : "s"}
          {loading ? " · loading…" : ""}
        </p>
        <Link
          href={`${AUTH_LINKS.superAdmin}/application-qa`}
          className={`${saMono} text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-700 hover:underline`}
        >
          ← Owners
        </Link>
      </div>

      <div className={saTableWrap}>
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className={`${saMono} text-[10px] uppercase tracking-[0.14em] text-slate-400`}>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Tab URL</th>
              <th className="px-4 py-3 font-medium">Page title</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Events</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="sticky right-0 bg-[#f8fafc] px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && sessions.length === 0 ? (
              <tr>
                <td colSpan={7} className={`${saMono} px-4 py-8 text-center text-xs text-slate-500`}>
                  No sessions match this filter.
                </td>
              </tr>
            ) : null}
            {sessions.map((session) => {
              const ownerLabel = displayApplicationQaOwnerName(
                session.owner || { email: undefined, id: session.userId }
              );
              const whenIso = session.lastSyncedAt || session.updatedAt || "";
              const whenParts = whenIso ? formatEstDateTimeParts(whenIso) : null;
              const whenFallback =
                (whenIso && formatEstDateTime(whenIso)) || whenIso || "—";
              return (
                <tr key={session.id} className="border-t border-slate-100 align-top">
                  <td className="min-w-[10rem] px-4 py-3">
                    <p className="break-words font-medium text-slate-800">{ownerLabel}</p>
                    {session.owner?.email ? (
                      <p className={`${saMono} mt-0.5 break-all text-[11px] text-slate-400`}>
                        {session.owner.email}
                      </p>
                    ) : null}
                  </td>
                  <td className="min-w-[16rem] max-w-[22rem] px-4 py-3">
                    {session.tabUrl ? (
                      <a
                        href={session.tabUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`${saMono} break-all text-xs text-teal-700 hover:underline`}
                      >
                        {session.tabUrl}
                      </a>
                    ) : (
                      <span className={`${saMono} text-xs text-slate-400`}>—</span>
                    )}
                  </td>
                  <td className="min-w-[12rem] max-w-[18rem] px-4 py-3 text-slate-700">
                    <span className="break-words whitespace-normal">
                      {session.pageTitle || "—"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={statusClass(session.status)}>{session.status}</span>
                  </td>
                  <td className={`${saMono} whitespace-nowrap px-4 py-3 text-xs text-slate-600`}>
                    <span>{session.eventCount || session.itemCount}</span>
                    {typeof session.matchedCount === "number" ? (
                      <span className="mt-0.5 block text-[10px] text-slate-400">
                        {session.matchedCount} matched
                      </span>
                    ) : null}
                  </td>
                  <td className={`${saMono} min-w-[9.5rem] px-4 py-3 text-[11px] text-slate-500`}>
                    {whenParts ? (
                      <span className="block whitespace-normal">
                        <span className="block">{whenParts.date}</span>
                        <span className="block">
                          {whenParts.time} {whenParts.zone}
                        </span>
                      </span>
                    ) : (
                      <span className="whitespace-normal">{whenFallback}</span>
                    )}
                  </td>
                  <td className="sticky right-0 whitespace-nowrap bg-white px-4 py-3 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)]">
                    <div className="flex flex-nowrap gap-2">
                      <Link
                        href={`${AUTH_LINKS.superAdmin}/application-qa/sessions/${encodeURIComponent(session.id)}`}
                        className={saBtnGhost}
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        disabled={deletingId === session.id}
                        onClick={() => void handleDelete(session)}
                        className={`${saBtnGhost} text-red-700 disabled:opacity-50`}
                      >
                        {deletingId === session.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className={saBtnGhost}
            disabled={page <= 1 || loading}
            onClick={() => void load(page - 1, userId, q)}
          >
            Previous
          </button>
          <p className={`${saMono} text-[11px] text-slate-500`}>
            Page {page} / {totalPages}
          </p>
          <button
            type="button"
            className={saBtnGhost}
            disabled={page >= totalPages || loading}
            onClick={() => void load(page + 1, userId, q)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
