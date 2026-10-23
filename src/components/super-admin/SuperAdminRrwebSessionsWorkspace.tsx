"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import RrwebReplayPlayer from "@/components/super-admin/RrwebReplayPlayer";
import {
  saAlert,
  saBtnGhost,
  saBtnPrimary,
  saCard,
  saDisplay,
  saEyebrow,
  saField,
  saLabel,
  saMono,
} from "@/components/super-admin/resume-dashboard-styles";
import {
  useRrwebSessionsLive,
  type RrwebSessionsLiveStatus,
} from "@/hooks/useRrwebSessionsLive";
import { getApiErrorMessage } from "@/lib/auth-api";
import {
  EST_TZ,
  formatEstDateTime,
  formatEstTime,
  formatYmdInTimezone,
  isIsoOnYmd,
} from "@/lib/format-est-datetime";
import {
  adjustOwnerUncheckedCount,
  displayRrwebOwnerName,
  formatDurationMs,
  hostnameFromRrwebUrl,
  isRrwebSessionUnread,
  loadRrwebEventsPayload,
  mergeRrwebSession,
  pickDefaultRrwebFrame,
  rrwebSessionActivityIso,
  rrwebSessionTitle,
  sortRrwebSessionsRecent,
  superAdminRrwebSessionsApi,
  upsertRrwebSessionList,
  type AdminRrwebSession,
  type AdminRrwebSessionDetail,
  type RrwebEventFrame,
  type RrwebSessionOwner,
  type RrwebSessionsLiveEvent,
} from "@/lib/super-admin-rrweb-sessions-api";

const TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "America/New_York (ET)" },
  { value: "America/Chicago", label: "America/Chicago (CT)" },
  { value: "America/Denver", label: "America/Denver (MT)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PT)" },
  { value: "UTC", label: "UTC" },
] as const;

const DEFAULT_TZ = EST_TZ;

/** Prefer uploaded sessions; allow in-progress recording. */
const LISTABLE_STATUSES = new Set(["uploaded", "recording"]);

function UncheckedBadge({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={`${saMono} inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white`}
      title={label}
      aria-label={label}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function statusBadgeClass(status: string): string {
  const key = status.toLowerCase();
  if (key === "uploaded") return "bg-teal-100 text-teal-800";
  if (key === "recording") return "bg-amber-100 text-amber-800";
  if (key === "deleted") return "bg-slate-100 text-slate-500";
  if (key === "failed" || key === "error") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-600";
}

type SuperAdminRrwebSessionsWorkspaceProps = {
  initialUserId?: string;
  initialDate?: string;
  initialSessionId?: string;
  initialTimezone?: string;
  onLiveStatusChange?: (status: RrwebSessionsLiveStatus) => void;
};

function sessionMatchesDay(
  session: AdminRrwebSession,
  day: string,
  timeZone: string
): boolean {
  const iso = rrwebSessionActivityIso(session);
  if (!iso) return true;
  return isIsoOnYmd(iso, day, timeZone);
}

export default function SuperAdminRrwebSessionsWorkspace({
  initialUserId = "",
  initialDate = "",
  initialSessionId = "",
  initialTimezone = "",
  onLiveStatusChange,
}: SuperAdminRrwebSessionsWorkspaceProps) {
  const todayYmd = formatYmdInTimezone(new Date(), DEFAULT_TZ);
  const [timezone, setTimezone] = useState(
    TIMEZONE_OPTIONS.some((z) => z.value === initialTimezone)
      ? initialTimezone
      : DEFAULT_TZ
  );
  const [dateYmd, setDateYmd] = useState(
    /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : todayYmd
  );

  const [owners, setOwners] = useState<RrwebSessionOwner[]>([]);
  const [ownersLoading, setOwnersLoading] = useState(true);
  const [ownersError, setOwnersError] = useState("");
  const [ownerQ, setOwnerQ] = useState("");
  const [draftOwnerQ, setDraftOwnerQ] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    initialUserId.trim() || null
  );

  const [sessionQ, setSessionQ] = useState("");
  const [draftSessionQ, setDraftSessionQ] = useState("");

  const [sessions, setSessions] = useState<AdminRrwebSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    initialSessionId.trim() || null
  );

  const [detail, setDetail] = useState<AdminRrwebSessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [frames, setFrames] = useState<RrwebEventFrame[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [activeFrameKey, setActiveFrameKey] = useState<string>("top");
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [outsideFilterHint, setOutsideFilterHint] = useState("");
  const [flashIds, setFlashIds] = useState<Record<string, number>>({});

  const reviewPostedRef = useRef<Set<string>>(new Set());
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  const selectedUserIdRef = useRef(selectedUserId);
  const dateYmdRef = useRef(dateYmd);
  const timezoneRef = useRef(timezone);
  const selectedSessionIdRef = useRef(selectedSessionId);
  const detailRef = useRef(detail);
  const sessionQRef = useRef(sessionQ);
  selectedUserIdRef.current = selectedUserId;
  dateYmdRef.current = dateYmd;
  timezoneRef.current = timezone;
  selectedSessionIdRef.current = selectedSessionId;
  detailRef.current = detail;
  sessionQRef.current = sessionQ;

  const filteredOwners = useMemo(() => {
    const q = ownerQ.trim().toLowerCase();
    if (!q) return owners;
    return owners.filter((owner) => {
      const label = displayRrwebOwnerName(owner).toLowerCase();
      return (
        label.includes(q) ||
        owner.email.toLowerCase().includes(q) ||
        owner.userId.toLowerCase().includes(q)
      );
    });
  }, [owners, ownerQ]);

  const selectedOwner =
    owners.find((o) => o.userId === selectedUserId) ??
    filteredOwners.find((o) => o.userId === selectedUserId) ??
    null;

  const dateLabel = useMemo(() => {
    try {
      const [y, m, d] = dateYmd.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d, 12));
      return new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(dt);
    } catch {
      return dateYmd;
    }
  }, [dateYmd]);

  const loadOwners = useCallback(async (preferSelected?: string | null) => {
    setOwnersLoading(true);
    setOwnersError("");
    try {
      const list = await superAdminRrwebSessionsApi.listOwners();
      setOwners(list);
      setSelectedUserId((prev) => {
        const prefer = preferSelected?.trim() || null;
        if (prefer && list.some((o) => o.userId === prefer)) return prefer;
        if (prev && list.some((o) => o.userId === prev)) return prev;
        return list[0]?.userId ?? null;
      });
    } catch (err) {
      setOwners([]);
      setOwnersError(getApiErrorMessage(err, "Could not load session owners."));
    } finally {
      setOwnersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOwners(initialUserId.trim() || null);
  }, [loadOwners, initialUserId]);

  useEffect(() => {
    const sid = initialSessionId.trim();
    if (!sid || initialUserId.trim()) return;

    let cancelled = false;
    (async () => {
      try {
        const session = await superAdminRrwebSessionsApi.getSession(sid);
        if (cancelled) return;
        if (session.userId) setSelectedUserId(session.userId);
        const iso = rrwebSessionActivityIso(session);
        if (iso) {
          const ymd = formatYmdInTimezone(new Date(iso), timezoneRef.current);
          if (ymd) setDateYmd(ymd);
        }
        setSelectedSessionId(session.id);
        setDetail(session);
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialSessionId, initialUserId]);

  const loadSessions = useCallback(
    async (userId: string, day: string, tz: string, q: string) => {
      if (!userId) {
        setSessions([]);
        setSessionsError("");
        setSelectedSessionId(null);
        return;
      }

      setSessionsLoading(true);
      setSessionsError("");
      try {
        const result = await superAdminRrwebSessionsApi.listSessions({
          userId,
          date: day,
          timezone: tz,
          q: q.trim() || undefined,
          page: 1,
          limit: 100,
        });

        const filtered = sortRrwebSessionsRecent(
          result.sessions.filter((session) => {
            if (!sessionMatchesDay(session, day, tz)) return false;
            const st = session.status.toLowerCase();
            if (st === "deleted" || st === "failed") return false;
            if (!LISTABLE_STATUSES.has(st) && st) {
              // still show unknown statuses that aren't deleted/failed
              return st !== "deleted";
            }
            return true;
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
        setSessionsError(getApiErrorMessage(err, "Could not load apply attempts."));
      } finally {
        setSessionsLoading(false);
      }
    },
    [initialSessionId]
  );

  useEffect(() => {
    if (!selectedUserId) {
      setSessions([]);
      setSelectedSessionId(null);
      setDetail(null);
      setFrames([]);
      return;
    }
    void loadSessions(selectedUserId, dateYmd, timezone, sessionQ);
  }, [selectedUserId, dateYmd, timezone, sessionQ, loadSessions]);

  useEffect(() => {
    reviewPostedRef.current.clear();
    setFrames([]);
    setEventsError("");
    setActiveFrameKey("top");
  }, [selectedSessionId]);

  const applySessionReviewUpdate = useCallback(
    (incoming: AdminRrwebSession | AdminRrwebSessionDetail) => {
      const existing =
        sessionsRef.current.find((s) => s.id === incoming.id) ||
        (detailRef.current?.id === incoming.id ? detailRef.current : null);
      const prevReviewed = existing?.reviewed;
      const merged = mergeRrwebSession(existing, incoming);

      setSessions((prev) => {
        if (!prev.some((s) => s.id === incoming.id)) {
          if (
            selectedUserIdRef.current &&
            incoming.userId === selectedUserIdRef.current &&
            sessionMatchesDay(incoming, dateYmdRef.current, timezoneRef.current)
          ) {
            return upsertRrwebSessionList(prev, merged);
          }
          return prev;
        }
        return upsertRrwebSessionList(prev, merged);
      });

      if (selectedSessionIdRef.current === incoming.id) {
        setDetail((prev) => mergeRrwebSession(prev, incoming));
      }

      setOwners((prev) => {
        if (existing) {
          return adjustOwnerUncheckedCount(
            prev,
            incoming.userId,
            prevReviewed,
            merged.reviewed
          );
        }
        if (merged.reviewed === false) {
          return adjustOwnerUncheckedCount(prev, incoming.userId, true, false);
        }
        return prev;
      });
    },
    []
  );

  const markSessionReviewed = useCallback(
    async (sessionId: string) => {
      const sid = sessionId.trim();
      if (!sid) return;
      if (reviewPostedRef.current.has(sid)) return;

      const source =
        detailRef.current?.id === sid
          ? detailRef.current
          : sessionsRef.current.find((s) => s.id === sid);
      if (source && !isRrwebSessionUnread(source)) {
        reviewPostedRef.current.add(sid);
        return;
      }

      reviewPostedRef.current.add(sid);
      try {
        const session = await superAdminRrwebSessionsApi.reviewSession(sid);
        applySessionReviewUpdate(session);
      } catch {
        reviewPostedRef.current.delete(sid);
      }
    },
    [applySessionReviewUpdate]
  );

  useEffect(() => {
    if (!selectedSessionId) {
      setDetail(null);
      setDetailError("");
      setFrames([]);
      return;
    }

    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      setDetailError("");
      setEventsLoading(true);
      setEventsError("");
      try {
        const next = await superAdminRrwebSessionsApi.getSession(selectedSessionId);
        if (cancelled) return;
        setDetail(next);
        void markSessionReviewed(next.id);

        try {
          const payload = await loadRrwebEventsPayload(next);
          if (cancelled) return;
          setFrames(payload.frames);
          const def = pickDefaultRrwebFrame(payload.frames);
          setActiveFrameKey(def?.frameKey || "top");
        } catch (err) {
          if (!cancelled) {
            setFrames([]);
            setEventsError(
              getApiErrorMessage(err, "Could not load replay events.")
            );
          }
        } finally {
          if (!cancelled) setEventsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setDetail(null);
          setFrames([]);
          setDetailError(getApiErrorMessage(err, "Could not load session detail."));
          setEventsLoading(false);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSessionId, markSessionReviewed]);

  const flashSession = useCallback((sessionId: string) => {
    const token = Date.now();
    setFlashIds((prev) => ({ ...prev, [sessionId]: token }));
    window.setTimeout(() => {
      setFlashIds((prev) => {
        if (prev[sessionId] !== token) return prev;
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
    }, 2200);
  }, []);

  const clearSelectedSessionLocally = useCallback((message?: string) => {
    setSelectedSessionId(null);
    setDetail(null);
    setFrames([]);
    if (message) setToast(message);
  }, []);

  const applySessionRemoved = useCallback(
    (sessionId: string, userId?: string, message?: string) => {
      const existing = sessionsRef.current.find((s) => s.id === sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (selectedSessionIdRef.current === sessionId) {
        clearSelectedSessionLocally(message ?? "Session deleted.");
      }
      if (existing && existing.reviewed === false) {
        setOwners((prev) =>
          adjustOwnerUncheckedCount(prev, existing.userId || userId || "", false, true)
        );
      } else if (!existing && userId) {
        // unknown prior state — leave badge; owners refresh can fix
      }
      setOwners((prev) =>
        prev.map((o) => {
          const uid = existing?.userId || userId;
          if (!uid || o.userId !== uid) return o;
          return {
            ...o,
            sessionCount: Math.max(0, (o.sessionCount || 0) - 1),
          };
        })
      );
    },
    [clearSelectedSessionLocally]
  );

  const handleLiveEvent = useCallback(
    (event: RrwebSessionsLiveEvent) => {
      if (event.kind === "ready") return;

      if (event.kind === "session.deleted") {
        applySessionRemoved(event.sessionId, event.userId, "Session deleted (live).");
        return;
      }

      if (event.kind === "session.reviewed") {
        if (event.session) {
          applySessionReviewUpdate({ ...event.session, reviewed: true });
        } else {
          const existing =
            sessionsRef.current.find((s) => s.id === event.sessionId) ||
            (detailRef.current?.id === event.sessionId ? detailRef.current : null);
          if (existing) {
            applySessionReviewUpdate({ ...existing, reviewed: true });
          } else if (event.userId) {
            setOwners((prev) =>
              adjustOwnerUncheckedCount(prev, event.userId!, false, true)
            );
          }
        }
        reviewPostedRef.current.add(event.sessionId);
        return;
      }

      const session = event.session;
      const matchesUser =
        !selectedUserIdRef.current || session.userId === selectedUserIdRef.current;
      const matchesDay = sessionMatchesDay(
        session,
        dateYmdRef.current,
        timezoneRef.current
      );

      if (event.kind === "session.created") {
        setOwners((prev) => {
          const exists = prev.some((o) => o.userId === session.userId);
          if (!exists) {
            // soft bump — full owners refresh is optional
            return prev;
          }
          return prev.map((o) => {
            if (o.userId !== session.userId) return o;
            return {
              ...o,
              sessionCount: (o.sessionCount || 0) + 1,
              lastStartedAt: session.startedAt || o.lastStartedAt,
              uncheckedCount:
                session.reviewed === false
                  ? (o.uncheckedCount || 0) + 1
                  : o.uncheckedCount,
            };
          });
        });
      }

      if (matchesUser && matchesDay) {
        applySessionReviewUpdate(session);
        flashSession(session.id);
        setOutsideFilterHint("");
      } else if (matchesUser && !matchesDay) {
        setOutsideFilterHint(
          `Live update for ${rrwebSessionTitle(session)} is outside the selected day.`
        );
      }
    },
    [applySessionRemoved, applySessionReviewUpdate, flashSession]
  );

  const liveStatus = useRrwebSessionsLive({
    enabled: true,
    onEvent: handleLiveEvent,
  });

  useEffect(() => {
    onLiveStatusChange?.(liveStatus);
  }, [liveStatus, onLiveStatusChange]);

  async function handleDeleteSession(session: AdminRrwebSession) {
    const title = rrwebSessionTitle(session);
    if (
      !window.confirm(
        `Delete apply attempt “${title}”? This removes the rrweb replay (sensitive PII).`
      )
    ) {
      return;
    }
    setDeletingSessionId(session.id);
    try {
      await superAdminRrwebSessionsApi.deleteSession(session.id);
      applySessionRemoved(session.id, session.userId, "Session deleted.");
    } catch (err) {
      setToast(getApiErrorMessage(err, "Could not delete session."));
    } finally {
      setDeletingSessionId(null);
    }
  }

  function handleOwnerSearch(event: FormEvent) {
    event.preventDefault();
    setOwnerQ(draftOwnerQ);
  }

  function handleSessionSearch(event: FormEvent) {
    event.preventDefault();
    setSessionQ(draftSessionQ.trim());
  }

  const showFrameSwitcher = (detail?.frameCount ?? frames.length) > 1 && frames.length > 1;

  return (
    <div className="flex min-h-[min(78vh,52rem)] flex-col gap-4 xl:h-[min(78vh,52rem)]">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="sa-rrweb-date" className={saLabel}>
              Date
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="sa-rrweb-date"
                type="date"
                className={saField}
                value={dateYmd}
                onChange={(e) => {
                  setDateYmd(e.target.value || todayYmd);
                  setToast("");
                  setOutsideFilterHint("");
                }}
              />
              {dateYmd !== todayYmd ? (
                <button
                  type="button"
                  className={`${saBtnGhost} shrink-0`}
                  onClick={() => setDateYmd(formatYmdInTimezone(new Date(), timezone))}
                >
                  Today
                </button>
              ) : null}
            </div>
          </div>
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="sa-rrweb-tz" className={saLabel}>
              Timezone
            </label>
            <select
              id="sa-rrweb-tz"
              className={`${saField} mt-1.5`}
              value={timezone}
              onChange={(e) => {
                setTimezone(e.target.value || DEFAULT_TZ);
                setToast("");
                setOutsideFilterHint("");
              }}
            >
              {TIMEZONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <p className={`${saMono} text-[11px] text-slate-400 sm:pb-2`}>
            {dateLabel} · {timezone}
          </p>
        </div>
      </div>

      {toast ? (
        <p
          className={`${saMono} shrink-0 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-[11px] text-teal-900`}
          role="status"
        >
          {toast}
        </p>
      ) : null}

      {outsideFilterHint ? (
        <p
          className={`${saMono} shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900`}
          role="status"
        >
          {outsideFilterHint}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row xl:items-stretch">
        {/* Left — owners */}
        <aside
          className={`${saCard} flex min-h-0 w-full shrink-0 flex-col overflow-hidden max-xl:max-h-[40%] xl:h-full xl:w-[260px] 2xl:w-[300px]`}
        >
          <div className="shrink-0 border-b border-slate-100 p-4">
            <form onSubmit={handleOwnerSearch} className="space-y-2">
              <label htmlFor="sa-rrweb-owner-search" className={saLabel}>
                Profiles
              </label>
              <div className="flex gap-2">
                <input
                  id="sa-rrweb-owner-search"
                  value={draftOwnerQ}
                  onChange={(e) => setDraftOwnerQ(e.target.value)}
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
              {filteredOwners.length} owner{filteredOwners.length === 1 ? "" : "s"}
              {ownersLoading ? " · loading…" : ""}
            </p>
          </div>

          {ownersError ? (
            <div className={`${saMono} ${saAlert} m-3 shrink-0 px-3 py-2 text-[11px]`} role="alert">
              {ownersError}
            </div>
          ) : null}

          <ul
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"
            role="listbox"
            aria-label="Replay session owners"
          >
            {ownersLoading && owners.length === 0 ? (
              <li className={`${saMono} px-4 py-8 text-center text-xs text-slate-400`}>
                Loading…
              </li>
            ) : filteredOwners.length === 0 ? (
              <li className={`${saMono} px-4 py-8 text-center text-xs text-slate-400`}>
                No owners{ownerQ ? ` for “${ownerQ}”` : ""}.
              </li>
            ) : (
              filteredOwners.map((owner) => {
                const active = owner.userId === selectedUserId;
                const unchecked = owner.uncheckedCount || 0;
                return (
                  <li key={owner.userId}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        setSelectedUserId(owner.userId);
                        setToast("");
                        setOutsideFilterHint("");
                      }}
                      className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors duration-200 ${
                        active
                          ? "bg-teal-50 text-slate-900"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`min-w-0 flex-1 truncate text-sm font-medium ${
                            active ? "text-teal-900" : "text-slate-900"
                          }`}
                        >
                          {displayRrwebOwnerName(owner)}
                        </span>
                        <UncheckedBadge
                          count={unchecked}
                          label={`${unchecked} unreviewed apply attempt${unchecked === 1 ? "" : "s"}`}
                        />
                      </span>
                      <span className={`${saMono} truncate text-[11px] text-slate-400`}>
                        {owner.email || owner.userId}
                        {owner.sessionCount
                          ? ` · ${owner.sessionCount} session${owner.sessionCount === 1 ? "" : "s"}`
                          : ""}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        {/* Center — apply attempts */}
        <section
          className={`${saCard} flex min-h-0 w-full shrink-0 flex-col overflow-hidden max-xl:max-h-[40%] xl:h-full xl:w-[320px] 2xl:w-[360px]`}
        >
          <div className="shrink-0 border-b border-slate-100 p-4">
            <p className={saEyebrow}>Apply attempts</p>
            <p className={`${saMono} mt-2 text-[11px] text-slate-400`}>
              {selectedOwner ? displayRrwebOwnerName(selectedOwner) : "Select a profile"} ·{" "}
              {dateLabel}
              {sessionsLoading
                ? " · loading…"
                : ` · ${sessions.length} attempt${sessions.length === 1 ? "" : "s"}`}
            </p>
            <form onSubmit={handleSessionSearch} className="mt-3 flex gap-2">
              <input
                value={draftSessionQ}
                onChange={(e) => setDraftSessionQ(e.target.value)}
                className={saField}
                placeholder="Search URL or title…"
                spellCheck={false}
                aria-label="Search apply attempts"
              />
              <button type="submit" className={`${saBtnPrimary} shrink-0 px-3`}>
                Go
              </button>
            </form>
          </div>

          {sessionsError ? (
            <div className={`${saMono} ${saAlert} m-3 shrink-0 px-3 py-2 text-[11px]`} role="alert">
              {sessionsError}
            </div>
          ) : null}

          <ul
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"
            role="listbox"
            aria-label="rrweb apply attempts"
          >
            {!selectedUserId ? (
              <li className={`${saMono} px-4 py-8 text-center text-xs text-slate-400`}>
                Select a profile to load attempts.
              </li>
            ) : sessionsLoading && sessions.length === 0 ? (
              <li className={`${saMono} px-4 py-8 text-center text-xs text-slate-400`}>
                Loading…
              </li>
            ) : sessions.length === 0 ? (
              <li className={`${saMono} px-4 py-8 text-center text-xs text-slate-400`}>
                No apply attempts for this day.
              </li>
            ) : (
              sessions.map((session) => {
                const active = session.id === selectedSessionId;
                const flashing = Boolean(flashIds[session.id]);
                const deletingThis = deletingSessionId === session.id;
                const unread = isRrwebSessionUnread(session);
                return (
                  <li key={session.id}>
                    <div
                      className={`flex gap-2 px-2 py-2 transition-colors duration-200 ${
                        active
                          ? "bg-teal-50 text-slate-900"
                          : "text-slate-700 hover:bg-slate-50"
                      } ${flashing ? "sa-live-flash" : ""}`}
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          setSelectedSessionId(session.id);
                          setToast("");
                        }}
                        className="flex min-w-0 flex-1 flex-col gap-0.5 px-2 py-1 text-left"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={`min-w-0 flex-1 truncate text-sm font-medium ${
                              active ? "text-teal-900" : "text-slate-900"
                            }`}
                          >
                            {rrwebSessionTitle(session)}
                          </span>
                          {unread ? (
                            <UncheckedBadge count={1} label="Unreviewed apply attempt" />
                          ) : null}
                        </span>
                        <span className={`${saMono} truncate text-[11px] text-slate-400`}>
                          {hostnameFromRrwebUrl(session.primaryUrl)}
                        </span>
                        <span className={`${saMono} mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400`}>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusBadgeClass(session.status)}`}
                          >
                            {session.status}
                          </span>
                          <span>
                            {formatEstTime(rrwebSessionActivityIso(session)) ||
                              formatEstDateTime(rrwebSessionActivityIso(session)) ||
                              "—"}
                          </span>
                          <span className="opacity-40">·</span>
                          <span>{formatDurationMs(session.durationMs)}</span>
                          {session.frameCount > 1 ? (
                            <>
                              <span className="opacity-40">·</span>
                              <span>{session.frameCount} frames</span>
                            </>
                          ) : null}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(deletingSessionId)}
                        title="Delete apply attempt"
                        aria-label={`Delete ${rrwebSessionTitle(session)}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeleteSession(session);
                        }}
                        className={`${saBtnGhost} h-8 shrink-0 self-start border-rose-200 px-2 text-[10px] text-rose-700 hover:bg-rose-50`}
                      >
                        {deletingThis ? "…" : "Delete"}
                      </button>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </section>

        {/* Right — metadata + player */}
        <section className={`${saCard} flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden xl:h-full`}>
          <div className="shrink-0 border-b border-slate-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={saEyebrow}>Session replay</p>
                <h2 className={`${saDisplay} mt-2 truncate text-lg font-bold text-slate-900`}>
                  {detail
                    ? rrwebSessionTitle(detail)
                    : detailLoading
                      ? "Loading…"
                      : selectedSessionId
                        ? "Apply attempt"
                        : "Select an attempt"}
                </h2>
                {detail?.primaryUrl ? (
                  <a
                    href={detail.primaryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${saMono} mt-1 block truncate text-xs text-teal-700 hover:underline`}
                  >
                    {detail.primaryUrl}
                  </a>
                ) : null}
                {detail ? (
                  <p className={`${saMono} mt-2 text-[11px] text-slate-400`}>
                    {formatDurationMs(detail.durationMs)}
                    <span className="mx-1.5 opacity-40">·</span>
                    {detail.eventCount} events
                    <span className="mx-1.5 opacity-40">·</span>
                    {detail.frameCount || frames.length || 1} frame
                    {(detail.frameCount || frames.length || 1) === 1 ? "" : "s"}
                    <span className="mx-1.5 opacity-40">·</span>
                    <span className={detail.reviewed ? "text-teal-700" : "text-rose-700"}>
                      {detail.reviewed ? "Reviewed" : "Unreviewed"}
                    </span>
                  </p>
                ) : null}
              </div>
              {detail ? (
                <button
                  type="button"
                  disabled={Boolean(deletingSessionId)}
                  onClick={() => void handleDeleteSession(detail)}
                  className={`${saBtnGhost} shrink-0 border-rose-200 text-rose-700 hover:bg-rose-50`}
                >
                  {deletingSessionId === detail.id ? "Deleting…" : "Delete"}
                </button>
              ) : null}
            </div>

            {showFrameSwitcher ? (
              <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Replay frames">
                {frames.map((frame) => {
                  const active = frame.frameKey === activeFrameKey;
                  return (
                    <button
                      key={frame.frameKey}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveFrameKey(frame.frameKey)}
                      className={`${saBtnGhost} max-w-[14rem] truncate px-2.5 py-1 text-[11px] ${
                        active ? "border-teal-300 bg-teal-50 text-teal-900" : ""
                      }`}
                      title={frame.href || frame.frameKey}
                    >
                      {frame.isTop ? "Top" : "Iframe"}
                      {frame.href ? ` · ${hostnameFromRrwebUrl(frame.href)}` : ""}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {detailError ? (
            <div className={`${saMono} ${saAlert} m-3 shrink-0 px-3 py-2 text-[11px]`} role="alert">
              {detailError}
            </div>
          ) : null}
          {eventsError ? (
            <div className={`${saMono} ${saAlert} m-3 shrink-0 px-3 py-2 text-[11px]`} role="alert">
              {eventsError}
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col">
            {!selectedSessionId ? (
              <p className={`${saMono} flex flex-1 items-center justify-center px-4 text-center text-xs text-slate-400`}>
                Select an apply attempt to watch the DOM replay.
              </p>
            ) : detailLoading || eventsLoading ? (
              <p
                className={`${saMono} flex flex-1 items-center justify-center text-xs text-slate-400`}
                aria-busy="true"
              >
                Loading replay…
              </p>
            ) : frames.length > 0 ? (
              <RrwebReplayPlayer
                frames={frames}
                frameKey={activeFrameKey}
                onPlay={() => {
                  if (selectedSessionId) void markSessionReviewed(selectedSessionId);
                }}
              />
            ) : (
              <p className={`${saMono} flex flex-1 items-center justify-center px-4 text-center text-xs text-slate-400`}>
                No replay events for this session yet
                {detail?.status === "recording" ? " (still recording)." : "."}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
