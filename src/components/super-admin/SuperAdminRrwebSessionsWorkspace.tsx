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
  isIsoInZonedDay,
} from "@/lib/format-est-datetime";
import {
  adjustOwnerUncheckedCount,
  displayRrwebOwnerName,
  formatDurationMs,
  formatRrwebBytes,
  isRrwebSessionRecording,
  isRrwebSessionReplayable,
  isRrwebSessionUnread,
  formatRrwebLoadStatus,
  loadRrwebEventsPayload,
  mergeRrwebSession,
  pickTopFrame,
  rrwebBlockedLoadProgress,
  rrwebFrameLabel,
  rrwebReplayBlockedReason,
  rrwebSessionActivityIso,
  rrwebSessionStartedAtIso,
  rrwebSessionTitle,
  rrwebStatusBadgeLabel,
  sortRrwebSessionsRecent,
  superAdminRrwebSessionsApi,
  upsertRrwebSessionList,
  type AdminRrwebSession,
  type AdminRrwebSessionDetail,
  type RrwebEventFrame,
  type RrwebLoadProgress,
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

/**
 * Keep every frame in memory for tabs; auto-select TOP for first player mount.
 * Does not remount other frames until the user picks a tab.
 */
function applyFramesFromPayload(
  payload: { frames: RrwebEventFrame[] },
  setSessionFrames: (frames: RrwebEventFrame[]) => void,
  setActiveFrameKey: (key: string) => void
): boolean {
  const allFrames = payload.frames || [];
  if (!allFrames.length) return false;
  const top = pickTopFrame(allFrames);
  if (!top) return false;
  setSessionFrames(allFrames);
  setActiveFrameKey(top.frameKey);
  return true;
}

type SuperAdminRrwebSessionsWorkspaceProps = {
  initialUserId?: string;
  initialDate?: string;
  initialSessionId?: string;
  initialTimezone?: string;
  onLiveStatusChange?: (status: RrwebSessionsLiveStatus) => void;
};

/**
 * Selected-day membership via startedAt + zoned half-open bounds
 * (same idea as backend zonedDayBoundsUtc). Never use browser-local TZ alone.
 */
function sessionMatchesDay(
  session: Pick<AdminRrwebSession, "id" | "startedAt" | "endedAt">,
  day: string,
  timeZone: string,
  /** Prefer known startedAt from list/detail when SSE payload is sparse. */
  knownStartedAt?: string
): boolean {
  const iso =
    (knownStartedAt || "").trim() ||
    rrwebSessionStartedAtIso(session) ||
    rrwebSessionActivityIso(session);
  if (!iso) return true;
  return isIsoInZonedDay(iso, day, timeZone);
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
  /** All frames from the events payload (in memory for this session). */
  const [sessionFrames, setSessionFrames] = useState<RrwebEventFrame[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [loadProgress, setLoadProgress] = useState<RrwebLoadProgress>({
    phase: "idle",
  });
  const [activeFrameKey, setActiveFrameKey] = useState<string>("top");
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);
  const [toast, setToast] = useState("");
  /** Calm one-shot note when the open session is on another calendar day. */
  const [crossDayNote, setCrossDayNote] = useState<{
    sessionId: string;
    title: string;
    ymd: string;
  } | null>(null);
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
      setSessionFrames([]);
      return;
    }
    void loadSessions(selectedUserId, dateYmd, timezone, sessionQ);
  }, [selectedUserId, dateYmd, timezone, sessionQ, loadSessions]);

  useEffect(() => {
    reviewPostedRef.current.clear();
    setSessionFrames([]);
    setEventsError("");
    setActiveFrameKey("top");
    setCrossDayNote(null);
    setLoadProgress({ phase: "idle" });
    loadAbortRef.current?.abort();
    loadAbortRef.current = null;
  }, [selectedSessionId]);

  const reportLoadProgress = useCallback(
    (progress: RrwebLoadProgress, cancelled: () => boolean) => {
      if (cancelled()) return;
      setLoadProgress(progress);
    },
    []
  );

  const loadEventsIntoPlayer = useCallback(
    async (
      session: AdminRrwebSessionDetail,
      cancelled: () => boolean,
      opts?: { bypassCache?: boolean }
    ): Promise<boolean> => {
      if (!isRrwebSessionReplayable(session)) {
        if (!cancelled()) {
          setSessionFrames([]);
          setEventsError("");
          setEventsLoading(false);
          // Never keep "waiting" after uploaded/failed — recompute from status.
          setLoadProgress(rrwebBlockedLoadProgress(session));
        }
        return false;
      }

      loadAbortRef.current?.abort();
      const abort = new AbortController();
      loadAbortRef.current = abort;

      if (!cancelled()) {
        setEventsLoading(true);
        setEventsError("");
        setLoadProgress({ phase: "download", receivedBytes: 0 });
      }

      try {
        const recording = (session.status || "").toLowerCase() === "recording";
        const { payload, eventsBytes } = await loadRrwebEventsPayload(session, {
          bypassCache: opts?.bypassCache ?? recording,
          signal: abort.signal,
          onProgress: (progress) => reportLoadProgress(progress, cancelled),
        });
        if (cancelled() || abort.signal.aborted) return false;

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

        reportLoadProgress({ phase: "prepare" }, cancelled);
        // Yield so "Preparing player…" paints before frame state updates.
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 0);
        });
        if (cancelled() || abort.signal.aborted) return false;

        const ok = applyFramesFromPayload(
          payload,
          setSessionFrames,
          setActiveFrameKey
        );
        if (!ok) {
          setSessionFrames([]);
          setEventsError("No replay events for this frame");
          setLoadProgress({
            phase: "error",
            errorKind: "empty",
            message: "No replay events for this frame",
          });
          return false;
        }
        const top = pickTopFrame(payload.frames);
        const topEvents = Array.isArray(top?.events) ? top!.events.length : 0;
        if (topEvents < 2) {
          setEventsError("No replay events for this frame");
          setLoadProgress({
            phase: "error",
            errorKind: "empty",
            message: "No replay events for this frame",
          });
          return false;
        }
        setEventsError("");
        // Mount stage is reported by the player; stay on prepare until then.
        reportLoadProgress({ phase: "prepare" }, cancelled);
        return true;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return false;
        }
        if (!cancelled()) {
          setSessionFrames([]);
          const message = getApiErrorMessage(err, "Download failed — Retry");
          setEventsError(message);
          const lower = message.toLowerCase();
          const errorKind = lower.includes("decompress")
            ? "gunzip"
            : lower.includes("invalid") || lower.includes("parse")
              ? "parse"
              : "download";
          setLoadProgress({
            phase: "error",
            errorKind,
            message,
          });
        }
        return false;
      } finally {
        if (!cancelled() && !abort.signal.aborted) {
          setEventsLoading(false);
        }
      }
    },
    [reportLoadProgress]
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
        const wasReplayable = prevDetail
          ? isRrwebSessionReplayable(prevDetail)
          : false;
        const nowReplayable = isRrwebSessionReplayable(nextDetail);
        const recording = nextStatus === "recording";
        const statusFlippedOffRecording =
          prevStatus === "recording" &&
          (nextStatus === "uploaded" || nextStatus === "failed");
        const syncAdvanced =
          (nextDetail.eventCount || 0) > (prevDetail?.eventCount || 0) ||
          (nextDetail.eventsPath || "") !== (prevDetail?.eventsPath || "") ||
          (nextDetail.eventsUrl || "") !== (prevDetail?.eventsUrl || "") ||
          nextDetail.replayable !== prevDetail?.replayable ||
          (nextDetail.replayable === true && prevDetail?.replayable !== true) ||
          statusFlippedOffRecording;

        // Always clear stale waiting when status leaves recording without events.
        if (!nowReplayable) {
          setEventsLoading(false);
          setLoadProgress(rrwebBlockedLoadProgress(nextDetail));
          if (statusFlippedOffRecording && nextStatus === "uploaded") {
            setToast(
              `“${rrwebSessionTitle(nextDetail)}” finished — no events recorded.`
            );
          }
        }

        // When replayable flips true (or sync advances), refresh detail + load events.
        if (
          nowReplayable &&
          (!wasReplayable ||
            syncAdvanced ||
            (prevStatus === "recording" && nextStatus === "uploaded"))
        ) {
          if (!wasReplayable && nowReplayable) {
            setToast(
              recording
                ? "Ready — first sync landed. You can Play."
                : `“${rrwebSessionTitle(nextDetail)}” is ready to replay.`
            );
          } else if (
            prevStatus === "recording" &&
            nextStatus === "uploaded" &&
            nowReplayable
          ) {
            setToast(
              `“${rrwebSessionTitle(nextDetail)}” finished uploading — full replay ready.`
            );
          }
          void (async () => {
            try {
              const fresh = await superAdminRrwebSessionsApi.getSession(
                nextDetail.id
              );
              if (selectedSessionIdRef.current !== nextDetail.id) return;
              const mergedFresh = mergeRrwebSession(detailRef.current, fresh);
              setDetail(mergedFresh);
              if (!isRrwebSessionReplayable(mergedFresh)) {
                setEventsLoading(false);
                setLoadProgress(rrwebBlockedLoadProgress(mergedFresh));
                return;
              }
              await loadEventsIntoPlayer(mergedFresh, () =>
                selectedSessionIdRef.current !== nextDetail.id
              );
            } catch {
              if (isRrwebSessionReplayable(nextDetail)) {
                await loadEventsIntoPlayer(nextDetail, () =>
                  selectedSessionIdRef.current !== nextDetail.id
                ).catch(() => {
                  /* keep shell */
                });
              } else {
                setLoadProgress(rrwebBlockedLoadProgress(nextDetail));
              }
            }
          })();
        } else if (
          selectedSessionIdRef.current === incoming.id &&
          (recording || statusFlippedOffRecording) &&
          syncAdvanced
        ) {
          // Keep metadata fresh (recording wait OR post-close uploaded/failed).
          void superAdminRrwebSessionsApi
            .getSession(nextDetail.id)
            .then((fresh) => {
              if (selectedSessionIdRef.current !== nextDetail.id) return;
              const mergedFresh = mergeRrwebSession(detailRef.current, fresh);
              setDetail(mergedFresh);
              if (!isRrwebSessionReplayable(mergedFresh)) {
                setEventsLoading(false);
                setLoadProgress(rrwebBlockedLoadProgress(mergedFresh));
                return;
              }
              if (!wasReplayable) {
                void loadEventsIntoPlayer(mergedFresh, () =>
                  selectedSessionIdRef.current !== nextDetail.id
                );
              }
            })
            .catch(() => {
              /* ignore */
            });
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
      setSessionFrames([]);
      setEventsLoading(false);
      setLoadProgress({ phase: "idle" });
      loadAbortRef.current?.abort();
      return;
    }

    let cancelled = false;
    const isCancelled = () => cancelled;
    (async () => {
      setDetailLoading(true);
      setDetailError("");
      setEventsError("");
      setSessionFrames([]);

      const listRow = sessionsRef.current.find((s) => s.id === selectedSessionId);
      const earlySeed: AdminRrwebSessionDetail | null =
        listRow && isRrwebSessionReplayable(listRow)
          ? { ...listRow, events: null }
          : null;
      const earlyEventsPromise = earlySeed
        ? loadEventsIntoPlayer(earlySeed, isCancelled)
        : null;
      if (!earlyEventsPromise) {
        setEventsLoading(false);
        if (listRow && !isRrwebSessionReplayable(listRow)) {
          setLoadProgress(rrwebBlockedLoadProgress(listRow));
        }
      }

      try {
        // Metadata only — do not use ?includeEvents=1 (slow).
        const next = await superAdminRrwebSessionsApi.getSession(selectedSessionId);
        if (cancelled) return;
        setDetail(next);
        setDetailLoading(false);
        void markSessionReviewed(next.id);

        if (earlyEventsPromise) {
          await earlyEventsPromise;
          return;
        }

        if (!isRrwebSessionReplayable(next)) {
          setSessionFrames([]);
          setEventsLoading(false);
          setLoadProgress(rrwebBlockedLoadProgress(next));
          return;
        }
        await loadEventsIntoPlayer(next, isCancelled);
      } catch (err) {
        if (!cancelled) {
          setDetail(null);
          setSessionFrames([]);
          setDetailError(getApiErrorMessage(err, "Could not load session detail."));
          setEventsLoading(false);
          setDetailLoading(false);
          setLoadProgress({
            phase: "error",
            errorKind: "other",
            message: getApiErrorMessage(err, "Could not load session detail."),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      loadAbortRef.current?.abort();
    };
  }, [selectedSessionId, markSessionReviewed, loadEventsIntoPlayer]);

  const retryEventsLoad = useCallback(() => {
    const current = detailRef.current;
    if (!current || !selectedSessionId) return;
    void loadEventsIntoPlayer(current, () => false, { bypassCache: true });
  }, [selectedSessionId, loadEventsIntoPlayer]);

  const refreshEventsFromApi = useCallback(async () => {
    const current = detailRef.current;
    if (!current) return;
    if (selectedSessionId) void markSessionReviewed(selectedSessionId);
    try {
      const [fresh] = await Promise.all([
        superAdminRrwebSessionsApi.getSession(current.id),
        loadEventsIntoPlayer(current, () => false, { bypassCache: true }),
      ]);
      setDetail((prev) => mergeRrwebSession(prev, fresh));
    } catch {
      /* keep last frames */
    }
  }, [selectedSessionId, markSessionReviewed, loadEventsIntoPlayer]);

  const refreshRecordingEventsOnPlay = useCallback(async () => {
    const current = detailRef.current;
    if (!current) return;
    if (selectedSessionId) void markSessionReviewed(selectedSessionId);
    // Recording: refetch events on each play (partial/live).
    if (current.status.toLowerCase() !== "recording") return;
    try {
      await loadEventsIntoPlayer(current, () => false, { bypassCache: true });
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
    setSessionFrames([]);
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
      if (!matchesUser) return;

      const alreadyInList = sessionsRef.current.some((s) => s.id === session.id);
      const known =
        sessionsRef.current.find((s) => s.id === session.id) ||
        (detailRef.current?.id === session.id ? detailRef.current : null);
      const knownStartedAt =
        rrwebSessionStartedAtIso(known || session) ||
        rrwebSessionStartedAtIso(session);

      // Sessions already in the filtered list are never "outside selected day".
      const matchesDay =
        alreadyInList ||
        sessionMatchesDay(
          session,
          dateYmdRef.current,
          timezoneRef.current,
          knownStartedAt
        );

      const isOpen = selectedSessionIdRef.current === session.id;

      if (event.kind === "session.created") {
        setOwners((prev) => {
          const exists = prev.some((o) => o.userId === session.userId);
          if (!exists) return prev;
          return prev.map((o) => {
            if (o.userId !== session.userId) return o;
            return {
              ...o,
              sessionCount: (o.sessionCount || 0) + (alreadyInList ? 0 : 1),
              lastStartedAt: session.startedAt || o.lastStartedAt,
              uncheckedCount:
                !alreadyInList && session.reviewed === false
                  ? (o.uncheckedCount || 0) + 1
                  : o.uncheckedCount,
            };
          });
        });
      }

      if (matchesDay) {
        applySessionReviewUpdate(session);
        flashSession(session.id);
        setCrossDayNote((prev) =>
          prev?.sessionId === session.id ? null : prev
        );
        return;
      }

      // Outside selected day: never spam a yellow banner on every live flush.
      // Always refresh the open detail so replayable / eventCount stay current.
      if (isOpen) {
        applySessionReviewUpdate(session);
        const iso = knownStartedAt || rrwebSessionStartedAtIso(session);
        const jumpYmd = iso
          ? formatYmdInTimezone(new Date(iso), timezoneRef.current)
          : "";
        if (jumpYmd && jumpYmd !== dateYmdRef.current) {
          setCrossDayNote({
            sessionId: session.id,
            title: rrwebSessionTitle(session),
            ymd: jumpYmd,
          });
        }
      }
      // else: silently ignore — do not toast / banner
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

  const showFrameSwitcher = sessionFrames.length > 1;
  const detailReplayable = detail ? isRrwebSessionReplayable(detail) : false;
  const detailBlockedReason = detail ? rrwebReplayBlockedReason(detail) : null;
  // Prefer backend status only — never replayHints.liveReplay for Recording UI.
  const detailIsRecording = isRrwebSessionRecording(detail);
  const detailIsPartialLive = detailIsRecording && detailReplayable;
  const skipInactive = detail?.replayHints?.skipInactive !== false;

  /** Exactly one frame for the player — never merge timelines. */
  const activeFrame = useMemo(() => {
    if (!sessionFrames.length) return null;
    return sessionFrames.find((f) => f.frameKey === activeFrameKey) || null;
  }, [sessionFrames, activeFrameKey]);

  const playerFrames = useMemo(() => {
    if (!detailReplayable || !activeFrame) return [];
    return [activeFrame];
  }, [detailReplayable, activeFrame]);

  // Never keep a stale `waiting` once status is uploaded/failed.
  const displayLoadProgress = useMemo((): RrwebLoadProgress => {
    const pipelineBusy =
      loadProgress.phase === "download" ||
      loadProgress.phase === "gunzip" ||
      loadProgress.phase === "parse" ||
      loadProgress.phase === "prepare" ||
      loadProgress.phase === "mount";
    if (detail && !detailReplayable && !pipelineBusy && !eventsLoading) {
      return rrwebBlockedLoadProgress(detail);
    }
    if (detail && !detailIsRecording && loadProgress.phase === "waiting") {
      return rrwebBlockedLoadProgress(detail);
    }
    return loadProgress;
  }, [
    detail,
    detailReplayable,
    detailIsRecording,
    loadProgress,
    eventsLoading,
  ]);

  const loadStatusText = formatRrwebLoadStatus(displayLoadProgress);
  const loadBusy =
    displayLoadProgress.phase === "download" ||
    displayLoadProgress.phase === "gunzip" ||
    displayLoadProgress.phase === "parse" ||
    displayLoadProgress.phase === "prepare" ||
    displayLoadProgress.phase === "mount" ||
    eventsLoading;
  const waitingFirstSync =
    displayLoadProgress.phase === "waiting" && detailIsRecording && !detailReplayable;

  const playerOverlayMessage = !selectedSessionId
    ? "Select a session URL above to watch."
    : detail && !detailReplayable
      ? detailBlockedReason ||
        (detailIsRecording
          ? "Waiting for first sync…"
          : "No events recorded for this session")
      : displayLoadProgress.phase === "error"
        ? loadStatusText || eventsError || "Failed — Retry"
        : loadBusy
          ? loadStatusText || "Loading…"
          : detailLoading
            ? "Loading session…"
            : eventsError
              ? eventsError
              : detailError
                ? detailError
                : sessionFrames.length === 0
                  ? detailBlockedReason ||
                    (detailIsRecording
                      ? "Waiting for first sync…"
                      : "No events recorded for this session")
                  : activeFrame &&
                      (!Array.isArray(activeFrame.events) ||
                        activeFrame.events.length < 2)
                    ? activeFrame.events?.length === 0
                      ? "No replay events for this frame"
                      : "This frame has too few events to replay."
                    : undefined;

  const playerStatusSecondary =
    activeFrame && detailReplayable
      ? rrwebFrameLabel(activeFrame)
      : detail
        ? rrwebSessionTitle(detail)
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
                  setCrossDayNote(null);
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
                setCrossDayNote(null);
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

      {crossDayNote ? (
        <div
          className={`${saMono} flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700`}
          role="status"
        >
          <span className="min-w-0 flex-1">
            “{crossDayNote.title}” started on {crossDayNote.ymd} (not the
            selected day). Live metadata still updates.
          </span>
          <button
            type="button"
            className={`${saBtnGhost} shrink-0 text-[11px]`}
            onClick={() => {
              setDateYmd(crossDayNote.ymd);
              setCrossDayNote(null);
            }}
          >
            Jump to {crossDayNote.ymd}
          </button>
          <button
            type="button"
            className={`${saBtnGhost} shrink-0 text-[11px]`}
            onClick={() => setCrossDayNote(null)}
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </div>
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
                        setCrossDayNote(null);
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
                    ? sessionFrames.map((frame) => {
                        const active = frame.frameKey === activeFrameKey;
                        const label = rrwebFrameLabel(frame);
                        return (
                          <button
                            key={frame.frameKey}
                            type="button"
                            onClick={() => setActiveFrameKey(frame.frameKey)}
                            className={`${saBtnGhost} max-w-[14rem] truncate px-2 py-1 text-[10px] ${
                              active ? "border-teal-300 bg-teal-50 text-teal-900" : ""
                            }`}
                            title={frame.href || frame.frameKey}
                          >
                            {label}
                          </button>
                        );
                      })
                    : sessionFrames.length === 1
                      ? (
                          <span
                            className={`${saMono} max-w-[14rem] truncate px-2 py-1 text-[10px] text-slate-500`}
                            title={sessionFrames[0]?.href || sessionFrames[0]?.frameKey}
                          >
                            {rrwebFrameLabel(sessionFrames[0])}
                          </span>
                        )
                      : null}
                </div>
              </div>

              <RrwebReplayPlayer
                key={`rrweb-tv-${activeFrameKey}`}
                className="min-h-[16rem] flex-1"
                frames={playerFrames}
                frameKey={activeFrameKey}
                skipInactive={skipInactive}
                busy={
                  Boolean(selectedSessionId) &&
                  (detailLoading || loadBusy || waitingFirstSync)
                }
                statusLabel={
                  displayLoadProgress.phase === "ready"
                    ? ""
                    : loadBusy ||
                        waitingFirstSync ||
                        displayLoadProgress.phase === "error"
                      ? loadStatusText
                      : playerOverlayMessage
                }
                statusSecondary={playerStatusSecondary}
                showRetry={
                  displayLoadProgress.phase === "error" &&
                  displayLoadProgress.errorKind !== "empty"
                }
                onRetry={retryEventsLoad}
                overlayMessage={
                  playerFrames.length > 0 &&
                  Array.isArray(activeFrame?.events) &&
                  (activeFrame?.events.length ?? 0) >= 2 &&
                  !loadBusy &&
                  displayLoadProgress.phase !== "error"
                    ? undefined
                    : playerOverlayMessage
                }
                onMountPhase={(phase) => {
                  if (phase === "mount") {
                    setLoadProgress({ phase: "mount" });
                  } else if (phase === "ready") {
                    setEventsLoading(false);
                    setLoadProgress({ phase: "ready" });
                  } else if (phase === "error") {
                    setLoadProgress({
                      phase: "error",
                      errorKind: "other",
                      message: "Loading player failed — Retry",
                    });
                  }
                }}
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
