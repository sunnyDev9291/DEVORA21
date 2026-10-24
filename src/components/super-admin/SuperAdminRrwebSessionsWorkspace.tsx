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
  formatEstTime,
  formatYmdInTimezone,
  isIsoOnYmd,
} from "@/lib/format-est-datetime";
import {
  adjustOwnerUncheckedCount,
  displayRrwebOwnerName,
  formatDurationMs,
  formatRrwebBytes,
  isRrwebSessionRecording,
  isRrwebSessionReplayable,
  isRrwebSessionUnread,
  loadRrwebEventsPayload,
  mergeRrwebSession,
  pickDefaultRrwebFrame,
  rrwebReplayBlockedReason,
  rrwebSessionActivityIso,
  rrwebSessionTitle,
  rrwebStatusBadgeLabel,
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

function statusBadgeClass(label: "Recording" | "Uploaded"): string {
  if (label === "Recording") {
    return "bg-rose-600 text-white shadow-sm shadow-rose-300/50 animate-pulse";
  }
  return "bg-slate-100 text-slate-600";
}

type StatusFilter = "all" | "recording" | "uploaded";

function applyFramesFromPayload(
  payload: { frames: RrwebEventFrame[] },
  setFrames: (frames: RrwebEventFrame[]) => void,
  setActiveFrameKey: (key: string) => void,
  onLazyAll?: (all: RrwebEventFrame[]) => void
): boolean {
  const allFrames = payload.frames;
  const top = pickDefaultRrwebFrame(allFrames);
  if (!top) return false;
  setFrames([top]);
  setActiveFrameKey(top.frameKey);
  if (allFrames.length > 1) {
    onLazyAll?.(allFrames);
  } else {
    setFrames(allFrames);
  }
  return true;
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
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
        // Keep open detail badges in sync with list status (poll/SSE → uploaded).
        const selectedId = selectedSessionIdRef.current;
        if (selectedId) {
          const row = filtered.find((s) => s.id === selectedId);
          if (row) {
            setDetail((prev) => {
              if (!prev || prev.id !== row.id) return prev;
              if (prev.status === row.status && prev.replayable === row.replayable) {
                return prev;
              }
              return mergeRrwebSession(prev, row);
            });
          }
        }
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

  const loadEventsIntoPlayer = useCallback(
    async (
      session: AdminRrwebSessionDetail,
      cancelled: () => boolean
    ): Promise<boolean> => {
      if (!isRrwebSessionReplayable(session)) {
        if (!cancelled()) {
          setFrames([]);
          setEventsError("");
          setEventsLoading(false);
        }
        return false;
      }
      if (!cancelled()) setEventsLoading(true);
      try {
        const { payload, eventsBytes } = await loadRrwebEventsPayload(session);
        if (cancelled()) return false;
        if (eventsBytes > 0) {
          setDetail((prev) =>
            prev && prev.id === session.id
              ? { ...prev, eventsBytes: Math.max(prev.eventsBytes || 0, eventsBytes) }
              : prev
          );
          setSessions((prev) =>
            prev.map((row) =>
              row.id === session.id
                ? {
                    ...row,
                    eventsBytes: Math.max(row.eventsBytes || 0, eventsBytes),
                  }
                : row
            )
          );
        }
        const ok = applyFramesFromPayload(
          payload,
          setFrames,
          setActiveFrameKey,
          (all) => {
            window.setTimeout(() => {
              if (!cancelled()) setFrames(all);
            }, 0);
          }
        );
        if (!ok) {
          setFrames([]);
          setEventsError("No replay frames in events payload.");
          return false;
        }
        setEventsError("");
        return true;
      } catch (err) {
        if (!cancelled()) {
          setFrames([]);
          setEventsError(
            getApiErrorMessage(err, "Could not load replay events.")
          );
        }
        return false;
      } finally {
        if (!cancelled()) setEventsLoading(false);
      }
    },
    []
  );

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
        const prevDetail = detailRef.current;
        const nextDetail = mergeRrwebSession(prevDetail, incoming);
        setDetail(nextDetail);

        const prevStatus = (prevDetail?.status || "").toLowerCase();
        const nextStatus = nextDetail.status.toLowerCase();
        if (prevStatus === "recording" && nextStatus === "uploaded") {
          setToast(`“${rrwebSessionTitle(nextDetail)}” finished uploading — full replay ready.`);
        }

        const wasReplayable = prevDetail
          ? isRrwebSessionReplayable(prevDetail)
          : false;
        const nowReplayable = isRrwebSessionReplayable(nextDetail);
        const recording = nextStatus === "recording";
        const syncAdvanced =
          (nextDetail.eventCount || 0) > (prevDetail?.eventCount || 0) ||
          (nextDetail.eventsPath || "") !== (prevDetail?.eventsPath || "") ||
          (nextDetail.eventsUrl || "") !== (prevDetail?.eventsUrl || "") ||
          nextDetail.replayable !== prevDetail?.replayable;

        if (nowReplayable && (!wasReplayable || (recording && syncAdvanced) || (prevStatus === "recording" && nextStatus === "uploaded"))) {
          void (async () => {
            try {
              const fresh = await superAdminRrwebSessionsApi.getSession(
                nextDetail.id
              );
              if (selectedSessionIdRef.current !== nextDetail.id) return;
              setDetail((prev) => mergeRrwebSession(prev, fresh));
              if (!isRrwebSessionReplayable(fresh)) return;
              await loadEventsIntoPlayer(fresh, () =>
                selectedSessionIdRef.current !== nextDetail.id
              );
            } catch {
              /* keep shell */
            }
          })();
        }
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
    [loadEventsIntoPlayer]
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
      setEventsLoading(false);
      return;
    }

    let cancelled = false;
    const isCancelled = () => cancelled;
    (async () => {
      setDetailLoading(true);
      setDetailError("");
      setEventsLoading(false);
      setEventsError("");
      setFrames([]);
      try {
        // Metadata only — do not use ?includeEvents=1 (slow).
        const next = await superAdminRrwebSessionsApi.getSession(selectedSessionId);
        if (cancelled) return;
        setDetail(next);
        setDetailLoading(false);
        void markSessionReviewed(next.id);

        if (!isRrwebSessionReplayable(next)) {
          setFrames([]);
          setEventsLoading(false);
          return;
        }
        await loadEventsIntoPlayer(next, isCancelled);
      } catch (err) {
        if (!cancelled) {
          setDetail(null);
          setFrames([]);
          setDetailError(getApiErrorMessage(err, "Could not load session detail."));
          setEventsLoading(false);
          setDetailLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSessionId, markSessionReviewed, loadEventsIntoPlayer]);

  const refreshEventsFromApi = useCallback(async () => {
    const current = detailRef.current;
    if (!current) return;
    if (selectedSessionId) void markSessionReviewed(selectedSessionId);
    try {
      const fresh = await superAdminRrwebSessionsApi.getSession(current.id);
      setDetail((prev) => mergeRrwebSession(prev, fresh));
      if (!isRrwebSessionReplayable(fresh)) return;
      await loadEventsIntoPlayer(fresh, () => false);
    } catch {
      /* keep last frames */
    }
  }, [selectedSessionId, markSessionReviewed, loadEventsIntoPlayer]);

  const refreshRecordingEventsOnPlay = useCallback(async () => {
    const current = detailRef.current;
    if (!current) return;
    if (selectedSessionId) void markSessionReviewed(selectedSessionId);
    // Recording: refetch events on each play (partial/live, no long cache).
    if (current.status.toLowerCase() !== "recording") return;
    try {
      const fresh = await superAdminRrwebSessionsApi.getSession(current.id);
      setDetail((prev) => mergeRrwebSession(prev, fresh));
      if (!isRrwebSessionReplayable(fresh)) return;
      await loadEventsIntoPlayer(fresh, () => false);
    } catch {
      /* keep last frames */
    }
  }, [selectedSessionId, markSessionReviewed, loadEventsIntoPlayer]);

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

  // Polling fallback while SSE is down (list from backend, not extension).
  useEffect(() => {
    if (!selectedUserId) return;
    if (liveStatus === "live" || liveStatus === "connecting") return;
    const timer = window.setInterval(() => {
      void loadSessions(
        selectedUserIdRef.current || selectedUserId,
        dateYmdRef.current,
        timezoneRef.current,
        sessionQRef.current
      );
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [selectedUserId, liveStatus, loadSessions]);

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

  const filteredSessions = useMemo(() => {
    if (statusFilter === "all") return sessions;
    return sessions.filter(
      (s) => s.status.toLowerCase() === statusFilter
    );
  }, [sessions, statusFilter]);

  const listTotals = useMemo(() => {
    let durationMs = 0;
    let eventCount = 0;
    let eventsBytes = 0;
    for (const s of filteredSessions) {
      durationMs += s.durationMs || 0;
      eventCount += s.eventCount || 0;
      eventsBytes += s.eventsBytes || 0;
    }
    return {
      count: filteredSessions.length,
      durationMs,
      eventCount,
      eventsBytes,
      sizeLabel: formatRrwebBytes(eventsBytes),
    };
  }, [filteredSessions]);

  const showFrameSwitcher = (detail?.frameCount ?? frames.length) > 1 && frames.length > 1;
  const detailReplayable = detail ? isRrwebSessionReplayable(detail) : false;
  const detailBlockedReason = detail ? rrwebReplayBlockedReason(detail) : null;
  // Prefer backend status only — never replayHints.liveReplay for Recording UI.
  const detailIsRecording = isRrwebSessionRecording(detail);
  const detailIsPartialLive = detailIsRecording && detailReplayable;

  const playerOverlayMessage = !selectedSessionId
    ? "Select a session URL above to watch."
    : detail && !detailReplayable
      ? detailBlockedReason || "Waiting for first upload sync…"
      : detailLoading
        ? "Loading session…"
        : eventsLoading
          ? "Downloading events…"
          : eventsError
            ? eventsError
            : detailError
              ? detailError
              : frames.length === 0
                ? detailBlockedReason || "No replay events for this session yet."
                : undefined;

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
        {/* Left — profile selector */}
        <aside
          className={`${saCard} flex min-h-0 w-full shrink-0 flex-col overflow-hidden max-xl:max-h-[36%] xl:h-full xl:w-[240px] 2xl:w-[280px]`}
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
              {filteredOwners.length} profile{filteredOwners.length === 1 ? "" : "s"}
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
            aria-label="Replay session profiles"
          >
            {ownersLoading && owners.length === 0 ? (
              <li className={`${saMono} px-4 py-8 text-center text-xs text-slate-400`}>
                Loading…
              </li>
            ) : filteredOwners.length === 0 ? (
              <li className={`${saMono} px-4 py-8 text-center text-xs text-slate-400`}>
                No profiles{ownerQ ? ` for “${ownerQ}”` : ""}.
              </li>
            ) : (
              filteredOwners.map((owner) => {
                const active = owner.userId === selectedUserId;
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
                      <span
                        className={`truncate text-sm font-medium ${
                          active ? "text-teal-900" : "text-slate-900"
                        }`}
                      >
                        {displayRrwebOwnerName(owner)}
                      </span>
                      <span className={`${saMono} truncate text-[11px] text-slate-400`}>
                        {owner.email || owner.userId}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        {/* Right — URL list (with totals) + TV watch player */}
        <section className={`${saCard} flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden xl:h-full`}>
          <div className="flex min-h-0 flex-1 flex-col gap-0 lg:flex-row">
            {/* Session URL list */}
            <div className="flex min-h-0 w-full shrink-0 flex-col border-b border-slate-100 lg:w-[min(100%,22rem)] lg:border-b-0 lg:border-r">
              <div className="shrink-0 border-b border-slate-100 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={saEyebrow}>Session URLs</p>
                    <p className={`${saDisplay} mt-1 text-base font-bold text-slate-900`}>
                      {selectedOwner ? displayRrwebOwnerName(selectedOwner) : "Select a profile"}
                    </p>
                  </div>
                  <div className={`${saMono} shrink-0 rounded-xl bg-slate-50 px-2.5 py-1.5 text-right text-[10px] text-slate-500`}>
                    <div className="font-semibold text-slate-800">
                      {listTotals.count} session{listTotals.count === 1 ? "" : "s"}
                    </div>
                    <div>
                      {listTotals.sizeLabel || "—"}
                      <span className="mx-1 opacity-40">·</span>
                      {formatDurationMs(listTotals.durationMs)}
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSessionSearch} className="mt-3 flex gap-2">
                  <input
                    value={draftSessionQ}
                    onChange={(e) => setDraftSessionQ(e.target.value)}
                    className={saField}
                    placeholder="Filter URL…"
                    spellCheck={false}
                    aria-label="Filter session URLs"
                  />
                  <button type="submit" className={`${saBtnPrimary} shrink-0 px-3`}>
                    Go
                  </button>
                </form>

                <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Status filter">
                  {(
                    [
                      { id: "all", label: "All" },
                      { id: "recording", label: "Recording" },
                      { id: "uploaded", label: "Finished" },
                    ] as const
                  ).map((opt) => {
                    const active = statusFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setStatusFilter(opt.id)}
                        className={`${saBtnGhost} px-2.5 py-1 text-[11px] ${
                          active ? "border-teal-300 bg-teal-50 text-teal-900" : ""
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {sessionsError ? (
                <div className={`${saMono} ${saAlert} m-3 shrink-0 px-3 py-2 text-[11px]`} role="alert">
                  {sessionsError}
                </div>
              ) : null}

              <ul
                className="min-h-0 max-h-[40vh] flex-1 overflow-y-auto overscroll-contain py-1 lg:max-h-none"
                role="listbox"
                aria-label="Session URL list"
              >
                {!selectedUserId ? (
                  <li className={`${saMono} px-4 py-8 text-center text-xs text-slate-400`}>
                    Select a profile to load session URLs.
                  </li>
                ) : sessionsLoading && sessions.length === 0 ? (
                  <li className={`${saMono} px-4 py-8 text-center text-xs text-slate-400`}>
                    Loading…
                  </li>
                ) : filteredSessions.length === 0 ? (
                  <li className={`${saMono} px-4 py-8 text-center text-xs text-slate-400`}>
                    No session URLs
                    {statusFilter !== "all" ? ` (${statusFilter})` : " for this day"}.
                  </li>
                ) : (
                  filteredSessions.map((session) => {
                    const active = session.id === selectedSessionId;
                    const flashing = Boolean(flashIds[session.id]);
                    const deletingThis = deletingSessionId === session.id;
                    const statusBadge = rrwebStatusBadgeLabel(session.status);
                    const urlLabel =
                      session.primaryUrl?.trim() ||
                      rrwebSessionTitle(session) ||
                      "—";
                    return (
                      <li key={session.id}>
                        <div
                          className={`flex gap-1 px-1.5 py-1 transition-colors duration-200 ${
                            active ? "bg-teal-50" : "hover:bg-slate-50"
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
                            className="flex min-w-0 flex-1 flex-col gap-0.5 px-2 py-1.5 text-left"
                            title={urlLabel}
                          >
                            <span
                              className={`${saMono} truncate text-[12px] ${
                                active ? "font-medium text-teal-900" : "text-slate-800"
                              }`}
                            >
                              {urlLabel}
                            </span>
                            <span className={`${saMono} flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400`}>
                              {statusBadge === "Recording" ? (
                                <span
                                  className={`rounded-full px-1.5 py-0.5 font-medium ${statusBadgeClass("Recording")}`}
                                >
                                  Recording
                                </span>
                              ) : null}
                              {formatRrwebBytes(session.eventsBytes) ? (
                                <span className="font-medium text-slate-600">
                                  {formatRrwebBytes(session.eventsBytes)}
                                </span>
                              ) : null}
                              <span>
                                {formatEstTime(rrwebSessionActivityIso(session)) || "—"}
                              </span>
                              <span className="opacity-40">·</span>
                              <span>{formatDurationMs(session.durationMs)}</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(deletingSessionId)}
                            title="Delete session"
                            aria-label={`Delete ${urlLabel}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeleteSession(session);
                            }}
                            className={`${saBtnGhost} h-7 shrink-0 self-center border-rose-200 px-1.5 text-[10px] text-rose-700 hover:bg-rose-50`}
                          >
                            {deletingThis ? "…" : "×"}
                          </button>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>

            {/* TV watch player — direct play */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
              <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className={saEyebrow}>Watch</p>
                  {detailIsPartialLive ? (
                    <p className={`${saMono} mt-1 text-[11px] text-amber-800`}>
                      Partial replay — refresh to update.
                    </p>
                  ) : (
                    <p className={`${saMono} mt-1 text-[11px] text-slate-400`}>
                      TV direct play · no fullscreen
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {detailIsPartialLive ? (
                    <button
                      type="button"
                      disabled={eventsLoading}
                      onClick={() => void refreshEventsFromApi()}
                      className={`${saBtnGhost} text-[11px]`}
                    >
                      {eventsLoading ? "Refreshing…" : "Refresh"}
                    </button>
                  ) : null}
                  {showFrameSwitcher
                    ? frames.map((frame) => {
                        const active = frame.frameKey === activeFrameKey;
                        return (
                          <button
                            key={frame.frameKey}
                            type="button"
                            onClick={() => setActiveFrameKey(frame.frameKey)}
                            className={`${saBtnGhost} max-w-[10rem] truncate px-2 py-1 text-[10px] ${
                              active ? "border-teal-300 bg-teal-50 text-teal-900" : ""
                            }`}
                            title={frame.href || frame.frameKey}
                          >
                            {frame.isTop ? "Top" : "Iframe"}
                          </button>
                        );
                      })
                    : null}
                </div>
              </div>

              <RrwebReplayPlayer
                className="min-h-[16rem] flex-1"
                frames={frames.length > 0 && detailReplayable ? frames : []}
                frameKey={activeFrameKey}
                busy={Boolean(selectedSessionId) && (detailLoading || eventsLoading)}
                overlayMessage={
                  frames.length > 0 && detailReplayable ? undefined : playerOverlayMessage
                }
                onPlay={() => {
                  void refreshRecordingEventsOnPlay();
                }}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
