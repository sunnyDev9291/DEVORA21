"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  saAlert,
  saBtnGhost,
  saBtnPrimary,
  saCard,
  saChip,
  saChipActive,
  saDisplay,
  saEyebrow,
  saMono,
  saTableWrap,
} from "@/components/super-admin/resume-dashboard-styles";
import { AUTH_LINKS } from "@/lib/constants";
import { getApiErrorMessage } from "@/lib/auth-api";
import { formatEstDateTime } from "@/lib/format-est-datetime";
import {
  displayApplicationQaOwnerName,
  superAdminApplicationQaApi,
  type ApplicationQaSessionDetail,
} from "@/lib/super-admin-application-qa-api";

type SuperAdminApplicationQaDetailProps = {
  sessionId: string;
};

export default function SuperAdminApplicationQaDetail({
  sessionId,
}: SuperAdminApplicationQaDetailProps) {
  const router = useRouter();
  const [session, setSession] = useState<ApplicationQaSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const detail = await superAdminApplicationQaApi.getSession(sessionId);
        if (!cancelled) setSession(detail);
      } catch (err) {
        if (!cancelled) {
          setSession(null);
          setError(getApiErrorMessage(err, "Could not load session."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function handleDelete() {
    if (!session) return;
    const label = session.pageTitle || session.tabUrl || session.id;
    if (!window.confirm(`Delete session “${label}”? This cannot be undone.`)) return;

    setDeleting(true);
    setToast("");
    try {
      await superAdminApplicationQaApi.deleteSession(session.id);
      setToast("Session deleted. Returning to list…");
      const back = session.userId
        ? `${AUTH_LINKS.superAdmin}/application-qa/sessions?userId=${encodeURIComponent(session.userId)}`
        : `${AUTH_LINKS.superAdmin}/application-qa/sessions`;
      window.setTimeout(() => router.replace(back), 600);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not delete session."));
      setDeleting(false);
    }
  }

  if (loading) {
    return <p className={`${saMono} mt-8 text-xs text-slate-500`}>Loading session…</p>;
  }

  if (error && !session) {
    return (
      <div className="mt-8 space-y-4">
        <p className={`${saAlert} ${saMono} px-4 py-3 text-xs`} role="alert">
          {error}
        </p>
        <Link
          href={`${AUTH_LINKS.superAdmin}/application-qa/sessions`}
          className={saBtnGhost}
        >
          ← Back to sessions
        </Link>
      </div>
    );
  }

  if (!session) return null;

  const ownerName = displayApplicationQaOwnerName(
    session.owner || { id: session.userId }
  );
  const synced =
    (session.lastSyncedAt && formatEstDateTime(session.lastSyncedAt)) ||
    session.lastSyncedAt ||
    "—";
  const updated =
    (session.updatedAt && formatEstDateTime(session.updatedAt)) ||
    session.updatedAt ||
    "—";

  return (
    <div className="mt-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={
            session.userId
              ? `${AUTH_LINKS.superAdmin}/application-qa/sessions?userId=${encodeURIComponent(session.userId)}`
              : `${AUTH_LINKS.superAdmin}/application-qa/sessions`
          }
          className={`${saMono} text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-700 hover:underline`}
        >
          ← Sessions
        </Link>
        <button
          type="button"
          disabled={deleting}
          onClick={() => void handleDelete()}
          className={`${saBtnPrimary} bg-red-700 hover:bg-red-600 disabled:opacity-50`}
        >
          {deleting ? "Deleting…" : "Delete session"}
        </button>
      </div>

      {toast ? (
        <p
          className={`${saMono} rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-xs text-teal-800`}
          role="status"
        >
          {toast}
        </p>
      ) : null}
      {error ? (
        <p className={`${saAlert} ${saMono} px-4 py-3 text-xs`} role="alert">
          {error}
        </p>
      ) : null}

      <section className={`${saCard} p-5 sm:p-6`}>
        <p className={saEyebrow}>Owner</p>
        <p className={`${saDisplay} mt-2 text-xl font-bold text-slate-900`}>{ownerName}</p>
        {session.owner?.email ? (
          <p className={`${saMono} mt-1 text-xs text-slate-500`}>{session.owner.email}</p>
        ) : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className={saEyebrow}>Page</p>
            <p className="mt-2 font-medium text-slate-800">{session.pageTitle || "Untitled page"}</p>
            {session.tabUrl ? (
              <a
                href={session.tabUrl}
                target="_blank"
                rel="noreferrer"
                className={`${saMono} mt-1 inline-block break-all text-xs text-teal-700 hover:underline`}
              >
                {session.tabUrl}
              </a>
            ) : null}
          </div>
          <div className={`${saMono} space-y-2 text-xs text-slate-500`}>
            <p>
              Status{" "}
              <span className={session.status === "recording" ? saChipActive : saChip}>
                {session.status}
              </span>
            </p>
            <p>Items · {session.questionsAnswers.length || session.itemCount}</p>
            <p>Updated · {updated}</p>
            <p>Last sync · {synced}</p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className={saEyebrow}>Q&amp;A</p>
            <h2 className={`${saDisplay} mt-1 text-lg font-bold text-slate-900`}>
              Questions &amp; answers
            </h2>
          </div>
          <p className={`${saMono} text-[11px] text-slate-400`}>
            {session.questionsAnswers.length} pair
            {session.questionsAnswers.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className={saTableWrap}>
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className={`${saMono} text-[10px] uppercase tracking-[0.14em] text-slate-400`}>
                <th className="px-4 py-3 font-medium">Question</th>
                <th className="px-4 py-3 font-medium">Answer</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {session.questionsAnswers.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className={`${saMono} px-4 py-8 text-center text-xs text-slate-500`}
                  >
                    No question/answer pairs in this session.
                  </td>
                </tr>
              ) : (
                session.questionsAnswers.map((item, index) => {
                  const when =
                    (item.updatedAt && formatEstDateTime(item.updatedAt)) ||
                    item.updatedAt ||
                    "—";
                  return (
                    <tr
                      key={item.id || `${index}-${item.question.slice(0, 24)}`}
                      className="border-t border-slate-100 align-top"
                    >
                      <td className="max-w-md px-4 py-3 text-slate-800 whitespace-pre-wrap">
                        {item.question}
                      </td>
                      <td className="max-w-md px-4 py-3 text-slate-700 whitespace-pre-wrap">
                        {item.answer || (
                          <span className={`${saMono} text-xs text-slate-400`}>(empty)</span>
                        )}
                      </td>
                      <td className={`${saMono} whitespace-nowrap px-4 py-3 text-[11px] text-slate-500`}>
                        {when}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
