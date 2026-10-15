"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  saAlert,
  saBtnGhost,
  saBtnPrimary,
  saCard,
  saChip,
  saChipActive,
  saDisplay,
  saEyebrow,
  saField,
  saLabel,
  saMono,
} from "@/components/super-admin/resume-dashboard-styles";
import { getApiErrorMessage } from "@/lib/auth-api";
import {
  formatEstDateTime,
  formatEstTime,
  formatEstYmd,
  isIsoOnEstYmd,
} from "@/lib/format-est-datetime";
import { superAdminApi, type AdminUserSummary } from "@/lib/super-admin-api";
import {
  resolveApplicationQaCompanyName,
  sessionActivityIso,
  superAdminApplicationQaApi,
  type ApplicationQaSessionDetail,
  type ApplicationQaSessionSummary,
} from "@/lib/super-admin-application-qa-api";

function displayName(user: AdminUserSummary): string {
  return (
    user.name?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.email ||
    user.id
  );
}

function sortUsersByName(users: AdminUserSummary[]): AdminUserSummary[] {
  return [...users].sort((a, b) =>
    displayName(a).localeCompare(displayName(b), undefined, {
      sensitivity: "base",
      numeric: true,
    })
  );
}

function sortSessionsRecent(sessions: ApplicationQaSessionSummary[]): ApplicationQaSessionSummary[] {
  return [...sessions].sort((a, b) =>
    sessionActivityIso(b).localeCompare(sessionActivityIso(a))
  );
}

type SuperAdminApplicationQaWorkspaceProps = {
  initialUserId?: string;
  initialDate?: string;
  initialSessionId?: string;
};

export default function SuperAdminApplicationQaWorkspace({
  initialUserId = "",
  initialDate = "",
  initialSessionId = "",
}: SuperAdminApplicationQaWorkspaceProps) {
  const todayYmd = formatEstYmd();

  const [profileQ, setProfileQ] = useState("");
  const [draftProfileQ, setDraftProfileQ] = useState("");
  const [profilePage, setProfilePage] = useState(1);
  const [profiles, setProfiles] = useState<AdminUserSummary[]>([]);
  const [profileTotal, setProfileTotal] = useState(0);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    initialUserId.trim() || null
  );

  const [dateYmd, setDateYmd] = useState(
    /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : todayYmd
  );

  const [sessions, setSessions] = useState<ApplicationQaSessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    initialSessionId.trim() || null
  );

  const [detail, setDetail] = useState<ApplicationQaSessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState("");

  const profileLimit = 100;
  const profileTotalPages = Math.max(1, Math.ceil(profileTotal / profileLimit));
  const selectedProfile = profiles.find((u) => u.id === selectedUserId) ?? null;

  const loadProfiles = useCallback(
    async (page: number, query: string, preferSelected?: string | null) => {
      setProfilesLoading(true);
      setProfilesError("");
      try {
        const result = await superAdminApi.listUsers({
          q: query,
          page,
          limit: profileLimit,
        });
        const ordered = sortUsersByName(result.users);
        setProfiles(ordered);
        setProfileTotal(result.total);
        setProfilePage(result.page);

        const keep =
          preferSelected && ordered.some((u) => u.id === preferSelected)
            ? preferSelected
            : preferSelected && !ordered.some((u) => u.id === preferSelected)
              ? preferSelected
              : ordered[0]?.id ?? null;
        setSelectedUserId((prev) => {
          if (preferSelected && ordered.some((u) => u.id === preferSelected)) {
            return preferSelected;
          }
          if (prev && ordered.some((u) => u.id === prev)) return prev;
          return keep;
        });
      } catch (err) {
        setProfiles([]);
        setProfileTotal(0);
        setProfilesError(getApiErrorMessage(err, "Could not load profiles."));
      } finally {
        setProfilesLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadProfiles(1, "", initialUserId.trim() || null);
  }, [loadProfiles, initialUserId]);

  // Deep link: ?sessionId= only → resolve owner + Eastern day from the session.
  useEffect(() => {
    const sid = initialSessionId.trim();
    if (!sid || initialUserId.trim()) return;

    let cancelled = false;
    (async () => {
      try {
        const session = await superAdminApplicationQaApi.getSession(sid);
        if (cancelled) return;
        if (session.userId) setSelectedUserId(session.userId);
        const iso = sessionActivityIso(session);
        if (iso) {
          const ymd = formatEstYmd(new Date(iso));
          if (ymd) setDateYmd(ymd);
        }
        setSelectedSessionId(session.id);
        setDetail(session);
      } catch {
        // ignore — normal empty/error flow handles missing session
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialSessionId, initialUserId]);

  const loadSessions = useCallback(async (userId: string, day: string) => {
    if (!userId) {
      setSessions([]);
      setSessionsError("");
      setSelectedSessionId(null);
      return;
    }

    setSessionsLoading(true);
    setSessionsError("");
    try {
      const result = await superAdminApplicationQaApi.listSessions({
        userId,
        date: day,
        timezone: "America/New_York",
        page: 1,
        limit: 100,
      });

      // Client-side day filter when backend ignores `date` (until date filter ships).
      const filtered = sortSessionsRecent(
        result.sessions.filter((session) => {
          const iso = sessionActivityIso(session);
          if (!iso) return true;
          return isIsoOnEstYmd(iso, day);
        })
      );

      setSessions(filtered);
      setSelectedSessionId((prev) => {
        if (prev && filtered.some((s) => s.id === prev)) return prev;
        if (initialSessionId && filtered.some((s) => s.id === initialSessionId)) {
          return initialSessionId;
        }
        return filtered[0]?.id ?? null;
      });
    } catch (err) {
      setSessions([]);
      setSelectedSessionId(null);
      setSessionsError(getApiErrorMessage(err, "Could not load sessions."));
    } finally {
      setSessionsLoading(false);
    }
  }, [initialSessionId]);

  useEffect(() => {
    if (!selectedUserId) {
      setSessions([]);
      setSelectedSessionId(null);
      setDetail(null);
      return;
    }
    void loadSessions(selectedUserId, dateYmd);
  }, [selectedUserId, dateYmd, loadSessions]);

  useEffect(() => {
    if (!selectedSessionId) {
      setDetail(null);
      setDetailError("");
      return;
    }

    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const next = await superAdminApplicationQaApi.getSession(selectedSessionId);
        if (!cancelled) setDetail(next);
      } catch (err) {
        if (!cancelled) {
          setDetail(null);
          setDetailError(getApiErrorMessage(err, "Could not load session detail."));
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSessionId]);

  function handleProfileSearch(e: FormEvent) {
    e.preventDefault();
    const next = draftProfileQ.trim();
    setProfileQ(next);
    void loadProfiles(1, next, selectedUserId);
  }

  async function handleDeleteSelected() {
    if (!selectedSessionId || !detail) return;
    const label = resolveApplicationQaCompanyName(detail);
    if (!window.confirm(`Delete session “${label}”? This cannot be undone.`)) return;

    setDeleting(true);
    setToast("");
    try {
      await superAdminApplicationQaApi.deleteSession(selectedSessionId);
      setToast("Session deleted.");
      await loadSessions(selectedUserId || "", dateYmd);
    } catch (err) {
      setDetailError(getApiErrorMessage(err, "Could not delete session."));
    } finally {
      setDeleting(false);
    }
  }

  const dateLabel = useMemo(() => {
    if (dateYmd === todayYmd) return "Today";
    return dateYmd;
  }, [dateYmd, todayYmd]);

  return (
    <div className="mt-8 flex min-h-[74vh] flex-col gap-4 xl:flex-row xl:items-stretch xl:gap-4">
      {/* Left — profiles */}
      <aside
        className={`${saCard} flex w-full shrink-0 flex-col overflow-hidden xl:w-[260px] 2xl:w-[300px]`}
      >
        <div className="border-b border-slate-100 p-4">
          <form onSubmit={handleProfileSearch} className="space-y-2">
            <label htmlFor="sa-aqa-profile-search" className={saLabel}>
              Profiles
            </label>
            <div className="flex gap-2">
              <input
                id="sa-aqa-profile-search"
                value={draftProfileQ}
                onChange={(e) => setDraftProfileQ(e.target.value)}
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
            {profileTotal} account{profileTotal === 1 ? "" : "s"}
            {profilesLoading ? " · loading…" : ""}
          </p>
        </div>

        {profilesError ? (
          <div className={`${saMono} sa-alert m-3 px-3 py-2 text-[11px]`} role="alert">
            {profilesError}
          </div>
        ) : null}

        <ul className="min-h-0 flex-1 overflow-y-auto py-1" role="listbox" aria-label="Profiles">
          {profilesLoading && profiles.length === 0 ? (
            <li className={`${saMono} px-4 py-8 text-center text-xs text-slate-400`}>
              Loading…
            </li>
          ) : profiles.length === 0 ? (
            <li className={`${saMono} px-4 py-8 text-center text-xs text-slate-400`}>
              No profiles{profileQ ? ` for “${profileQ}”` : ""}.
            </li>
          ) : (
            profiles.map((user) => {
              const active = user.id === selectedUserId;
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setSelectedUserId(user.id);
                      setToast("");
                    }}
                    className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors duration-200 ${
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

        {profileTotalPages > 1 ? (
          <div
            className={`flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 ${saMono} text-[11px] text-slate-500`}
          >
            <span>
              {profilePage}/{profileTotalPages}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={profilesLoading || profilePage <= 1}
                onClick={() => void loadProfiles(profilePage - 1, profileQ, selectedUserId)}
                className={`${saBtnGhost} h-7 px-2`}
              >
                Prev
              </button>
              <button
                type="button"
                disabled={profilesLoading || profilePage >= profileTotalPages}
                onClick={() => void loadProfiles(profilePage + 1, profileQ, selectedUserId)}
                className={`${saBtnGhost} h-7 px-2`}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </aside>

      {/* Middle — sessions by date */}
      <section
        className={`${saCard} flex w-full shrink-0 flex-col overflow-hidden xl:w-[320px] 2xl:w-[360px]`}
      >
        <div className="border-b border-slate-100 p-4">
          <label htmlFor="sa-aqa-date" className={saLabel}>
            Session date
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              id="sa-aqa-date"
              type="date"
              value={dateYmd}
              max={todayYmd}
              onChange={(e) => {
                const next = e.target.value || todayYmd;
                setDateYmd(next);
                setToast("");
              }}
              className={saField}
            />
            {dateYmd !== todayYmd ? (
              <button
                type="button"
                className={`${saBtnGhost} shrink-0`}
                onClick={() => setDateYmd(todayYmd)}
              >
                Today
              </button>
            ) : null}
          </div>
          <p className={`${saMono} mt-2 text-[11px] text-slate-400`}>
            {selectedProfile ? displayName(selectedProfile) : "Select a profile"} · {dateLabel}
            {sessionsLoading ? " · loading…" : ` · ${sessions.length} session${sessions.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {sessionsError ? (
          <div className={`${saMono} sa-alert m-3 px-3 py-2 text-[11px]`} role="alert">
            {sessionsError}
          </div>
        ) : null}

        <ul className="min-h-0 flex-1 overflow-y-auto py-1" role="listbox" aria-label="Sessions">
          {!selectedUserId ? (
            <li className={`${saMono} px-4 py-10 text-center text-xs text-slate-400`}>
              Choose a profile to see Apply Page sessions.
            </li>
          ) : sessionsLoading && sessions.length === 0 ? (
            <li className={`${saMono} px-4 py-10 text-center text-xs text-slate-400`}>
              Loading sessions…
            </li>
          ) : sessions.length === 0 ? (
            <li className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-slate-700">No sessions</p>
              <p className={`${saMono} mt-2 text-xs text-slate-400`}>
                No recorded Apply Pages for this profile on {dateLabel}.
              </p>
            </li>
          ) : (
            sessions.map((session) => {
              const active = session.id === selectedSessionId;
              const company = resolveApplicationQaCompanyName(session);
              const iso = sessionActivityIso(session);
              const timeLabel = (iso && formatEstTime(iso)) || "—";
              return (
                <li key={session.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setSelectedSessionId(session.id);
                      setToast("");
                    }}
                    className={`flex w-full flex-col gap-1.5 border-l-2 px-4 py-3.5 text-left transition-all duration-200 ${
                      active
                        ? "border-teal-600 bg-teal-50/90"
                        : "border-transparent hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`text-sm font-semibold leading-snug ${
                          active ? "text-teal-950" : "text-slate-900"
                        }`}
                      >
                        {company}
                      </span>
                      <span
                        className={
                          session.status === "recording" ? saChipActive : saChip
                        }
                      >
                        {session.status}
                      </span>
                    </div>
                    {session.tabUrl ? (
                      <span className={`${saMono} line-clamp-2 break-all text-[11px] text-slate-400`}>
                        {session.tabUrl}
                      </span>
                    ) : null}
                    <div
                      className={`${saMono} flex flex-wrap gap-x-3 gap-y-1 text-[11px] ${
                        active ? "text-teal-800/80" : "text-slate-500"
                      }`}
                    >
                      <span>{timeLabel}</span>
                      <span>
                        {session.itemCount} Q&amp;A
                      </span>
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </section>

      {/* Right — Q&A detail */}
      <section className={`${saCard} flex min-w-0 flex-1 flex-col overflow-hidden`}>
        {!selectedUserId ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div>
              <p className={saEyebrow}>Master detail</p>
              <p className={`${saDisplay} mt-3 text-xl font-bold text-slate-900`}>
                Select a profile
              </p>
              <p className={`${saMono} mt-2 max-w-sm text-xs leading-relaxed text-slate-400`}>
                Pick a profile, choose a date, then open an Apply Page session to read every captured
                question and answer.
              </p>
            </div>
          </div>
        ) : !selectedSessionId ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div>
              <p className="text-sm font-medium text-slate-800">No session selected</p>
              <p className={`${saMono} mt-2 text-xs text-slate-400`}>
                Sessions for {dateLabel} appear in the middle column when available.
              </p>
            </div>
          </div>
        ) : detailLoading && !detail ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <p className={`${saMono} text-xs text-slate-400`}>Loading Q&amp;A…</p>
          </div>
        ) : detailError && !detail ? (
          <div className="p-5">
            <p className={`${saAlert} ${saMono} px-3 py-2.5 text-xs`} role="alert">
              {detailError}
            </p>
          </div>
        ) : detail ? (
          <>
            <div className="border-b border-slate-100 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={saEyebrow}>Session detail</p>
                  <h2 className={`${saDisplay} mt-2 text-2xl font-bold tracking-tight text-slate-900`}>
                    {resolveApplicationQaCompanyName(detail)}
                  </h2>
                  {detail.pageTitle &&
                  detail.pageTitle !== resolveApplicationQaCompanyName(detail) ? (
                    <p className="mt-1 text-sm text-slate-600">{detail.pageTitle}</p>
                  ) : null}
                  {detail.tabUrl ? (
                    <a
                      href={detail.tabUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`${saMono} mt-2 inline-block break-all text-xs text-teal-700 hover:underline`}
                    >
                      {detail.tabUrl}
                    </a>
                  ) : null}
                  <div className={`${saMono} mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500`}>
                    <span>
                      Status{" "}
                      <span className={detail.status === "recording" ? saChipActive : saChip}>
                        {detail.status}
                      </span>
                    </span>
                    <span>
                      Recorded ·{" "}
                      {(sessionActivityIso(detail) &&
                        formatEstDateTime(sessionActivityIso(detail))) ||
                        "—"}
                    </span>
                    <span>
                      {detail.questionsAnswers.length} pair
                      {detail.questionsAnswers.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void handleDeleteSelected()}
                  className={`${saBtnGhost} text-red-700 disabled:opacity-50`}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
              {toast ? (
                <p
                  className={`${saMono} mt-3 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800`}
                  role="status"
                >
                  {toast}
                </p>
              ) : null}
              {detailError ? (
                <p className={`${saAlert} ${saMono} mt-3 px-3 py-2 text-xs`} role="alert">
                  {detailError}
                </p>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {detail.questionsAnswers.length === 0 ? (
                <div className="flex min-h-[12rem] items-center justify-center text-center">
                  <p className={`${saMono} text-xs text-slate-400`}>
                    No question/answer pairs in this session.
                  </p>
                </div>
              ) : (
                <ol className="space-y-4">
                  {detail.questionsAnswers.map((item, index) => (
                    <li
                      key={item.id || `${index}-${item.question.slice(0, 24)}`}
                      className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition-colors duration-200 hover:border-teal-100 hover:bg-teal-50/30"
                    >
                      <p className={`${saMono} text-[10px] uppercase tracking-[0.14em] text-slate-400`}>
                        Question {index + 1}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-[15px] font-medium leading-relaxed text-slate-900">
                        {item.question}
                      </p>
                      <p className={`${saMono} mt-4 text-[10px] uppercase tracking-[0.14em] text-teal-700/70`}>
                        Answer
                      </p>
                      <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">
                        {item.answer || (
                          <span className="text-slate-400">(empty)</span>
                        )}
                      </p>
                      {item.updatedAt ? (
                        <p className={`${saMono} mt-3 text-[11px] text-slate-400`}>
                          Updated · {formatEstDateTime(item.updatedAt) || item.updatedAt}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
