"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
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
  useApplicationCapturesLive,
  type ApplicationCapturesLiveStatus,
} from "@/hooks/useApplicationCapturesLive";
import { getApiErrorMessage } from "@/lib/auth-api";
import {
  captureSessionTitle,
  hostnameFromCaptureUrl,
  type ApplicationCaptureImage,
} from "@/lib/application-captures-api";
import {
  EST_TZ,
  formatEstDateTime,
  formatEstTime,
  formatYmdInTimezone,
  isIsoInZonedDay,
} from "@/lib/format-est-datetime";
import {
  adjustOwnerUncheckedSessionCount,
  captureSessionActivityIso,
  displayCaptureOwnerName,
  isCaptureImageUnread,
  mergeCaptureSession,
  nearestLightboxIndex,
  removeCaptureImageFromSession,
  sortCaptureSessionsRecent,
  superAdminApplicationCapturesApi,
  upsertCaptureSessionList,
  type AdminApplicationCaptureSession,
  type ApplicationCaptureOwner,
  type ApplicationCapturesLiveEvent,
} from "@/lib/super-admin-application-captures-api";

const TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "America/New_York (ET)" },
  { value: "America/Chicago", label: "America/Chicago (CT)" },
  { value: "America/Denver", label: "America/Denver (MT)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PT)" },
  { value: "UTC", label: "UTC" },
] as const;

const DEFAULT_TZ = EST_TZ;

/** Screenshots panel shows one slice per page (full-height captures). */
const SCREENSHOTS_PER_PAGE = 1;

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
  if (key === "uploaded" || key === "ready" || key === "complete") {
    return "bg-teal-100 text-teal-800";
  }
  if (key === "deleted") {
    return "bg-slate-100 text-slate-500";
  }
  if (key === "failed" || key === "error") {
    return "bg-rose-100 text-rose-800";
  }
  return "bg-amber-100 text-amber-800";
}

function CaptureThumb({
  src,
  alt,
  className = "",
  fit = "cover",
  /** Scale image to parent bounds without overflowing (no scroll). */
  fill = false,
  onExpire,
}: {
  src?: string;
  alt: string;
  className?: string;
  fit?: "cover" | "contain";
  fill?: boolean;
  onExpire?: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const expireCalledRef = useRef(false);

  useEffect(() => {
    setBroken(false);
    expireCalledRef.current = false;
  }, [src]);

  const fitClass = fit === "contain" ? "object-contain" : "object-cover object-top";
  const fillClass = fill
    ? "absolute inset-0 m-auto h-full w-full max-h-full max-w-full"
    : "";

  if (!src || broken) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 text-slate-400 ${fill ? "absolute inset-0" : ""} ${className}`}
        aria-hidden
      >
        <svg className="h-7 w-7 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed Backblaze URLs
    <img
      src={src}
      alt={alt}
      className={`${fitClass} ${fillClass} grayscale ${className}`}
      loading="lazy"
      onError={() => {
        setBroken(true);
        if (!expireCalledRef.current && onExpire) {
          expireCalledRef.current = true;
          onExpire();
        }
      }}
    />
  );
}

function Lightbox({
  images,
  index,
  onClose,
  onIndexChange,
  onImageExpire,
  onDeleteImage,
  deleting,
}: {
  images: ApplicationCaptureImage[];
  index: number;
  onClose: () => void;
  onIndexChange: (next: number) => void;
  onImageExpire?: () => void;
  onDeleteImage?: (image: ApplicationCaptureImage, index: number) => void;
  deleting?: boolean;
}) {
  const image = images[index];
  const titleId = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" && index < images.length - 1) onIndexChange(index + 1);
      if (event.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, index, onClose, onIndexChange]);

  if (!image) return null;

  const canPrev = index > 0;
  const canNext = index < images.length - 1;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="relative flex h-[min(92dvh,56rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <p id={titleId} className={`${saMono} text-xs text-slate-600`}>
            Slice {index + 1} of {images.length}
            {image.width && image.height ? (
              <span className="ml-2 text-slate-400">
                {image.width}×{image.height}
              </span>
            ) : null}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {onDeleteImage ? (
              <button
                type="button"
                disabled={deleting}
                onClick={() => onDeleteImage(image, index)}
                className={`${saBtnGhost} border-rose-200 text-rose-700 hover:bg-rose-50`}
              >
                {deleting ? "Deleting…" : "Delete screenshot"}
              </button>
            ) : null}
            <button type="button" onClick={onClose} className={saBtnGhost}>
              Close
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-slate-50 p-3">
          {images.length > 1 ? (
            <button
              type="button"
              disabled={!canPrev || deleting}
              aria-label="Previous screenshot"
              onClick={() => onIndexChange(index - 1)}
              className={`${saBtnGhost} absolute left-3 top-1/2 z-10 -translate-y-1/2 px-3 py-2 disabled:opacity-40`}
            >
              ← Prev
            </button>
          ) : null}
          <CaptureThumb
            src={image.imageUrl}
            alt={`Capture slice ${index + 1}`}
            fit="contain"
            fill
            className="rounded-lg"
            onExpire={onImageExpire}
          />
          {images.length > 1 ? (
            <button
              type="button"
              disabled={!canNext || deleting}
              aria-label="Next screenshot"
              onClick={() => onIndexChange(index + 1)}
              className={`${saBtnGhost} absolute right-3 top-1/2 z-10 -translate-y-1/2 px-3 py-2 disabled:opacity-40`}
            >
              Next →
            </button>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            disabled={!canPrev || deleting || images.length <= 1}
            onClick={() => onIndexChange(index - 1)}
            className={saBtnGhost}
          >
            Previous
          </button>
          <p className={`${saMono} text-[11px] text-slate-500`}>
            {index + 1} / {images.length}
          </p>
          <button
            type="button"
            disabled={!canNext || deleting || images.length <= 1}
            onClick={() => onIndexChange(index + 1)}
            className={saBtnGhost}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

type SuperAdminApplicationCapturesWorkspaceProps = {
  initialUserId?: string;
  initialDate?: string;
  initialSessionId?: string;
  initialTimezone?: string;
  onLiveStatusChange?: (status: ApplicationCapturesLiveStatus) => void;
};

/**
 * Selected-day membership via capturedAt + zoned half-open bounds
 * (same idea as backend zonedDayBoundsUtc). Prefer known ISO when SSE is sparse.
 */
function sessionMatchesDay(
  session: Pick<
    AdminApplicationCaptureSession,
    "id" | "capturedAt" | "updatedAt" | "createdAt"
  >,
  day: string,
  timeZone: string,
  knownActivityIso?: string
): boolean {
  const iso =
    (knownActivityIso || "").trim() || captureSessionActivityIso(session);
  if (!iso) return true;
  return isIsoInZonedDay(iso, day, timeZone);
}

export default function SuperAdminApplicationCapturesWorkspace({
  initialUserId = "",
  initialDate = "",
  initialSessionId = "",
  initialTimezone = "",
  onLiveStatusChange,
}: SuperAdminApplicationCapturesWorkspaceProps) {
  const todayYmd = formatYmdInTimezone(new Date(), DEFAULT_TZ);
  const [timezone, setTimezone] = useState(
    TIMEZONE_OPTIONS.some((z) => z.value === initialTimezone)
      ? initialTimezone
      : DEFAULT_TZ
  );
  const [dateYmd, setDateYmd] = useState(
    /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : todayYmd
  );

  const [owners, setOwners] = useState<ApplicationCaptureOwner[]>([]);
  const [ownersLoading, setOwnersLoading] = useState(true);
  const [ownersError, setOwnersError] = useState("");
  const [ownerQ, setOwnerQ] = useState("");
  const [draftOwnerQ, setDraftOwnerQ] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    initialUserId.trim() || null
  );

  const [sessions, setSessions] = useState<AdminApplicationCaptureSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState("");
  const [sessionQ, setSessionQ] = useState("");
  const [draftSessionQ, setDraftSessionQ] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    initialSessionId.trim() || null
  );

  const [detail, setDetail] = useState<AdminApplicationCaptureSession | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [bulkDeletingSessions, setBulkDeletingSessions] = useState(false);
  const [bulkDeletingImages, setBulkDeletingImages] = useState(false);
  /** Multi-select for bulk session delete (independent of focused/open session). */
  const [checkedSessionIds, setCheckedSessionIds] = useState<Set<string>>(() => new Set());
  /** Multi-select for bulk screenshot delete within the open session. */
  const [checkedImageIds, setCheckedImageIds] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState("");
  const [outsideFilterHint, setOutsideFilterHint] = useState("");
  const [flashIds, setFlashIds] = useState<Record<string, number>>({});
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [screenshotPage, setScreenshotPage] = useState(1);
  const urlRefreshAttemptedRef = useRef<Set<string>>(new Set());
  /** In-flight / completed review POSTs for this view (avoid duplicate marks). */
  const reviewPostedRef = useRef<Set<string>>(new Set());
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  function toggleCheckedSession(sessionId: string) {
    setCheckedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }

  function toggleCheckedImage(imageId: string) {
    setCheckedImageIds((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  }

  const selectedUserIdRef = useRef(selectedUserId);
  const dateYmdRef = useRef(dateYmd);
  const timezoneRef = useRef(timezone);
  const selectedSessionIdRef = useRef(selectedSessionId);
  const lightboxIndexRef = useRef(lightboxIndex);
  const detailRef = useRef(detail);
  const sessionQRef = useRef(sessionQ);
  selectedUserIdRef.current = selectedUserId;
  dateYmdRef.current = dateYmd;
  timezoneRef.current = timezone;
  selectedSessionIdRef.current = selectedSessionId;
  lightboxIndexRef.current = lightboxIndex;
  detailRef.current = detail;
  sessionQRef.current = sessionQ;

  const filteredOwners = useMemo(() => {
    const q = ownerQ.trim().toLowerCase();
    if (!q) return owners;
    return owners.filter((owner) => {
      const label = displayCaptureOwnerName(owner).toLowerCase();
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

  const loadOwners = useCallback(async (preferSelected?: string | null) => {
    setOwnersLoading(true);
    setOwnersError("");
    try {
      const list = await superAdminApplicationCapturesApi.listOwners();
      setOwners(list);
      setSelectedUserId((prev) => {
        const prefer = preferSelected?.trim() || null;
        if (prefer && list.some((o) => o.userId === prefer)) return prefer;
        if (prev && list.some((o) => o.userId === prev)) return prev;
        return list[0]?.userId ?? null;
      });
    } catch (err) {
      setOwners([]);
      setOwnersError(getApiErrorMessage(err, "Could not load capture owners."));
    } finally {
      setOwnersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOwners(initialUserId.trim() || null);
  }, [loadOwners, initialUserId]);

  // Deep link: ?sessionId= only → resolve owner + day from the session.
  useEffect(() => {
    const sid = initialSessionId.trim();
    if (!sid || initialUserId.trim()) return;

    let cancelled = false;
    (async () => {
      try {
        const session = await superAdminApplicationCapturesApi.getSession(sid);
        if (cancelled) return;
        if (session.userId) setSelectedUserId(session.userId);
        const iso = captureSessionActivityIso(session);
        if (iso) {
          const ymd = formatYmdInTimezone(new Date(iso), timezoneRef.current);
          if (ymd) setDateYmd(ymd);
        }
        setSelectedSessionId(session.id);
        setDetail(session);
      } catch {
        // ignore — empty/error flow handles missing session
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
      urlRefreshAttemptedRef.current.clear();
      try {
        const result = await superAdminApplicationCapturesApi.listSessions({
          userId,
          date: day,
          timezone: tz,
          q: q.trim() || undefined,
          page: 1,
          limit: 100,
        });

        const filtered = sortCaptureSessionsRecent(
          result.sessions.filter((session) =>
            sessionMatchesDay(session, day, tz)
          )
        );

        // Merge with prior rows so a stale poll cannot wipe a fresher SSE snapshot.
        setSessions((prev) => {
          const prior = new Map(prev.map((s) => [s.id, s]));
          return sortCaptureSessionsRecent(
            filtered.map((row) => {
              const old = prior.get(row.id);
              return old ? mergeCaptureSession(old, row) : row;
            })
          );
        });
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
        setSessionsError(getApiErrorMessage(err, "Could not load capture sessions."));
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
      setLightboxIndex(null);
      setCheckedSessionIds(new Set());
      setCheckedImageIds(new Set());
      return;
    }
    setCheckedSessionIds(new Set());
    void loadSessions(selectedUserId, dateYmd, timezone, sessionQ);
  }, [selectedUserId, dateYmd, timezone, sessionQ, loadSessions]);

  // Drop stale session checks when the list changes (live deletes / reloads).
  useEffect(() => {
    setCheckedSessionIds((prev) => {
      if (prev.size === 0) return prev;
      const alive = new Set(sessions.map((s) => s.id));
      const next = new Set([...prev].filter((id) => alive.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [sessions]);

  // Clear image multi-select / screenshot page when opening a different session.
  // Do not mark images reviewed here — profile/session select alone must not check.
  useEffect(() => {
    setCheckedImageIds(new Set());
    setScreenshotPage(1);
    reviewPostedRef.current.clear();
  }, [selectedSessionId]);

  // Drop stale image checks when detail images change.
  useEffect(() => {
    const alive = new Set((detail?.images ?? []).map((img) => img.id));
    setCheckedImageIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set([...prev].filter((id) => alive.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [detail]);

  useEffect(() => {
    if (!selectedSessionId) {
      setDetail(null);
      setDetailError("");
      setLightboxIndex(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const next = await superAdminApplicationCapturesApi.getSession(selectedSessionId);
        if (!cancelled) {
          setDetail(next);
          // Keep lightbox open on the same index when possible.
          setLightboxIndex((prev) => {
            if (prev == null) return null;
            if (next.images.length === 0) return null;
            return Math.min(prev, next.images.length - 1);
          });
        }
      } catch (err) {
        if (!cancelled) {
          setDetail(null);
          setDetailError(getApiErrorMessage(err, "Could not load capture detail."));
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSessionId]);

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

  const refreshSignedUrls = useCallback(async (id: string) => {
    if (urlRefreshAttemptedRef.current.has(id)) return;
    urlRefreshAttemptedRef.current.add(id);
    try {
      const session = await superAdminApplicationCapturesApi.getSession(id);
      setDetail((prev) => (prev?.id === id ? mergeCaptureSession(prev, session) : prev));
      setSessions((prev) => {
        if (!prev.some((s) => s.id === id)) return prev;
        return upsertCaptureSessionList(
          prev,
          mergeCaptureSession(
            prev.find((s) => s.id === id),
            session
          )
        );
      });
      setLightboxIndex((prev) => {
        if (prev == null) return null;
        if (session.images.length === 0) return null;
        return Math.min(prev, session.images.length - 1);
      });
    } catch {
      // keep last good snapshot
    }
  }, []);

  const hydrateSessionDetail = useCallback((sessionId: string) => {
    const sid = sessionId.trim();
    if (!sid) return;
    void superAdminApplicationCapturesApi
      .getSession(sid)
      .then((full) => {
        if (selectedSessionIdRef.current !== sid) return;
        setDetail((prev) => mergeCaptureSession(prev, full));
        setDetailError("");
        setSessions((prev) => {
          if (!prev.some((s) => s.id === sid)) return prev;
          return upsertCaptureSessionList(prev, mergeCaptureSession(prev.find((s) => s.id === sid), full));
        });
        setLightboxIndex((prev) => {
          if (prev == null) return null;
          if (full.images.length === 0) return null;
          return Math.min(prev, full.images.length - 1);
        });
      })
      .catch(() => {
        /* keep last good SSE/REST snapshot */
      });
  }, []);

  /** Apply a session snapshot and keep profile/session unchecked badges in sync. */
  const applySessionReviewUpdate = useCallback(
    (incoming: AdminApplicationCaptureSession) => {
      const existing =
        sessionsRef.current.find((s) => s.id === incoming.id) ||
        (detailRef.current?.id === incoming.id ? detailRef.current : null);
      const prevUnchecked = existing?.uncheckedCount;
      const merged = mergeCaptureSession(existing, incoming);
      const nextUnchecked = merged.uncheckedCount;

      setSessions((prev) => {
        if (!prev.some((s) => s.id === incoming.id)) {
          // Only upsert into list when it belongs to the open profile/day.
          if (
            selectedUserIdRef.current &&
            incoming.userId === selectedUserIdRef.current &&
            sessionMatchesDay(incoming, dateYmdRef.current, timezoneRef.current)
          ) {
            return upsertCaptureSessionList(prev, merged);
          }
          return prev;
        }
        return upsertCaptureSessionList(prev, merged);
      });

      if (selectedSessionIdRef.current === incoming.id) {
        setDetail((prev) => mergeCaptureSession(prev, incoming));
      }

      setOwners((prev) => {
        if (existing) {
          return adjustOwnerUncheckedSessionCount(
            prev,
            incoming.userId,
            prevUnchecked,
            nextUnchecked
          );
        }
        // New session (e.g. SSE created) — bump profile badge when it has unread slices.
        if ((nextUnchecked ?? 0) > 0) {
          return adjustOwnerUncheckedSessionCount(
            prev,
            incoming.userId,
            0,
            nextUnchecked
          );
        }
        return prev;
      });
    },
    []
  );

  /**
   * Mark one unread screenshot reviewed — only when the slide is opened
   * (click / lightbox active). Never on profile/session select alone.
   */
  const markImageReviewed = useCallback(
    async (sessionId: string, imageId: string) => {
      const sid = sessionId.trim();
      const iid = imageId.trim();
      if (!sid || !iid) return;

      const key = `${sid}:${iid}`;
      if (reviewPostedRef.current.has(key)) return;

      const source =
        detailRef.current?.id === sid
          ? detailRef.current
          : sessionsRef.current.find((s) => s.id === sid);
      const image = source?.images.find((img) => img.id === iid);
      if (!image || !isCaptureImageUnread(image)) return;

      reviewPostedRef.current.add(key);
      try {
        const session = await superAdminApplicationCapturesApi.reviewImage(sid, iid);
        applySessionReviewUpdate(session);
      } catch {
        reviewPostedRef.current.delete(key);
      }
    },
    [applySessionReviewUpdate]
  );

  const clearSelectedSessionLocally = useCallback((message?: string) => {
    setSelectedSessionId(null);
    setDetail(null);
    setLightboxIndex(null);
    if (message) setToast(message);
  }, []);

  const applySessionRemoved = useCallback(
    (sessionId: string, message?: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (selectedSessionIdRef.current === sessionId) {
        clearSelectedSessionLocally(message ?? "Capture deleted.");
      }
    },
    [clearSelectedSessionLocally]
  );

  const applyImageRemovedLocally = useCallback(
    (sessionId: string, imageId: string, nextSession?: AdminApplicationCaptureSession | null) => {
      const isSelected = selectedSessionIdRef.current === sessionId;

      if (nextSession === null) {
        applySessionRemoved(sessionId, "Capture deleted.");
        return;
      }

      setSessions((prev) => {
        const existing = prev.find((s) => s.id === sessionId);
        // Unrelated session not in the open profile/day list — leave list alone.
        if (!existing && !isSelected) return prev;
        const next =
          nextSession ??
          (existing ? removeCaptureImageFromSession(existing, imageId) : null);
        if (!next) return prev.filter((s) => s.id !== sessionId);
        return upsertCaptureSessionList(
          prev.filter((s) => s.id !== sessionId),
          next
        );
      });

      if (!isSelected) return;

      const fromDetail =
        detailRef.current?.id === sessionId ? detailRef.current : null;
      const updated =
        nextSession ??
        (fromDetail ? removeCaptureImageFromSession(fromDetail, imageId) : null);

      if (updated === null && fromDetail) {
        // Last image removed locally → session is gone.
        clearSelectedSessionLocally("Capture deleted.");
        return;
      }

      if (updated) {
        const deletedIndex =
          fromDetail?.images.findIndex((img) => img.id === imageId) ?? -1;
        const openIdx = lightboxIndexRef.current;
        setDetail(updated);
        setDetailError("");
        if (openIdx != null) {
          const base = deletedIndex >= 0 ? deletedIndex : openIdx;
          setLightboxIndex(nearestLightboxIndex(base, updated.images.length));
        }
        return;
      }

      // Selected but no local detail rows yet — refetch; do not steal selection.
      hydrateSessionDetail(sessionId);
    },
    [applySessionRemoved, clearSelectedSessionLocally, hydrateSessionDetail]
  );

  const handleLiveEvent = useCallback(
    (event: ApplicationCapturesLiveEvent) => {
      if (event.kind === "ready") return;

      if (event.kind === "session.deleted") {
        const { sessionId, userId } = event;
        applySessionRemoved(sessionId, "Capture deleted.");
        if (userId) {
          setOwners((prev) =>
            prev.map((o) =>
              o.userId !== userId
                ? o
                : {
                    ...o,
                    captureCount: Math.max(0, (o.captureCount || 0) - 1),
                  }
            )
          );
        }
        if (userId && userId === selectedUserIdRef.current) {
          setOutsideFilterHint("");
        }
        return;
      }

      if (event.kind === "image.deleted") {
        const { sessionId, imageId, session, sessionDeleted } = event;
        if (sessionDeleted || session === null) {
          applySessionRemoved(sessionId, "Capture deleted.");
          return;
        }
        applyImageRemovedLocally(sessionId, imageId, session);
        flashSession(sessionId);
        return;
      }

      if (event.kind === "image.reviewed") {
        if (event.session) {
          applySessionReviewUpdate(event.session);
          flashSession(event.session.id);
          return;
        }
        // Sparse event — mark local image reviewed if we have it.
        const existing =
          sessionsRef.current.find((s) => s.id === event.sessionId) ||
          (detailRef.current?.id === event.sessionId ? detailRef.current : null);
        if (!existing) return;
        const images = existing.images.map((img) =>
          img.id === event.imageId ? { ...img, reviewed: true } : img
        );
        const uncheckedCount = images.filter((img) => img.reviewed === false).length;
        applySessionReviewUpdate({
          ...existing,
          images,
          uncheckedCount,
        });
        flashSession(event.sessionId);
        return;
      }

      const session = event.session;
      const ownerId = session.userId;
      const openOwner = selectedUserIdRef.current;
      const openDay = dateYmdRef.current;
      const openTz = timezoneRef.current;
      const matchesOwner = Boolean(openOwner && ownerId && ownerId === openOwner);
      const alreadyInList = sessionsRef.current.some((s) => s.id === session.id);
      const known =
        sessionsRef.current.find((s) => s.id === session.id) ||
        (detailRef.current?.id === session.id ? detailRef.current : null);
      const knownIso = captureSessionActivityIso(known || session);
      // Sessions already in the filtered list are never "outside selected day".
      const matchesDay =
        alreadyInList ||
        sessionMatchesDay(session, openDay, openTz, knownIso);
      const isOpen = selectedSessionIdRef.current === session.id;
      const sparsePayload = session.images.length === 0 && session.sliceCount > 0;

      if (event.kind === "session.created" && ownerId) {
        setOwners((prev) => {
          const exists = prev.some((o) => o.userId === ownerId);
          if (!exists) return prev;
          return prev.map((o) => {
            if (o.userId !== ownerId) return o;
            return {
              ...o,
              captureCount: (o.captureCount || 0) + (alreadyInList ? 0 : 1),
              lastCapturedAt:
                captureSessionActivityIso(session) || o.lastCapturedAt,
            };
          });
        });
      }

      // Upsert list/detail from SSE payload immediately — no full page refresh.
      applySessionReviewUpdate(session);

      if (isOpen) {
        setDetailError("");
        if (session.images.length > 0 || session.sliceCount === 0) {
          setLightboxIndex((idx) => {
            if (idx == null) return null;
            if (session.images.length === 0) return null;
            return Math.min(idx, session.images.length - 1);
          });
        }
        // Always refresh open detail so new slices appear without manual reload.
        if (sparsePayload || event.kind === "session.updated") {
          hydrateSessionDetail(session.id);
        }
      }

      if (!matchesOwner) {
        return;
      }

      if (matchesDay) {
        flashSession(session.id);
        setOutsideFilterHint("");
        return;
      }

      // Outside selected day: only note when the open session jumps days.
      if (isOpen) {
        const jumpYmd = knownIso
          ? formatYmdInTimezone(new Date(knownIso), openTz)
          : "";
        if (jumpYmd && jumpYmd !== openDay) {
          setOutsideFilterHint(
            `Open capture “${captureSessionTitle(session)}” is on ${jumpYmd}, not ${openDay}.`
          );
        }
      }
      flashSession(session.id);
    },
    [
      applyImageRemovedLocally,
      applySessionRemoved,
      applySessionReviewUpdate,
      flashSession,
      hydrateSessionDetail,
    ]
  );

  const liveStatus = useApplicationCapturesLive({
    enabled: true,
    onEvent: handleLiveEvent,
  });

  useEffect(() => {
    onLiveStatusChange?.(liveStatus);
  }, [liveStatus, onLiveStatusChange]);

  // Light poll only while SSE is down (list from backend, not extension).
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

  function handleOwnerSearch(e: FormEvent) {
    e.preventDefault();
    setOwnerQ(draftOwnerQ.trim());
  }

  function handleSessionSearch(e: FormEvent) {
    e.preventDefault();
    setSessionQ(draftSessionQ.trim());
  }

  async function handleDeleteSession(session: AdminApplicationCaptureSession) {
    const label = captureSessionTitle(session);
    if (
      !window.confirm(
        `Delete URL session “${label}”? This removes the capture and all screenshot slices.`
      )
    ) {
      return;
    }

    setDeletingSessionId(session.id);
    setToast("");
    setSessionsError("");
    try {
      await superAdminApplicationCapturesApi.deleteSession(session.id);
      applySessionRemoved(session.id, "Capture deleted.");
      setCheckedSessionIds((prev) => {
        if (!prev.has(session.id)) return prev;
        const next = new Set(prev);
        next.delete(session.id);
        return next;
      });
    } catch (err) {
      const message = getApiErrorMessage(err, "Could not delete capture session.");
      if (selectedSessionIdRef.current === session.id) {
        setDetailError(message);
      } else {
        setSessionsError(message);
      }
    } finally {
      setDeletingSessionId(null);
    }
  }

  async function handleDeleteCheckedSessions() {
    const ids = sessions.map((s) => s.id).filter((id) => checkedSessionIds.has(id));
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Delete ${ids.length} URL session${ids.length === 1 ? "" : "s"}? This removes each capture and all of its screenshot slices.`
      )
    ) {
      return;
    }

    setBulkDeletingSessions(true);
    setToast("");
    setSessionsError("");
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      setDeletingSessionId(id);
      try {
        await superAdminApplicationCapturesApi.deleteSession(id);
        applySessionRemoved(id);
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    setDeletingSessionId(null);
    setCheckedSessionIds(new Set());
    setBulkDeletingSessions(false);
    if (fail === 0) {
      setToast(
        ok === 1 ? "Capture deleted." : `${ok} captures deleted.`
      );
    } else {
      setSessionsError(
        `Deleted ${ok}, failed ${fail}. Some URL sessions could not be removed.`
      );
    }
  }

  async function deleteOneImage(
    sessionId: string,
    image: ApplicationCaptureImage
  ): Promise<"ok" | "session-gone" | "error"> {
    try {
      const result = await superAdminApplicationCapturesApi.deleteImage(
        sessionId,
        image.id
      );
      if (result.sessionDeleted) {
        applySessionRemoved(sessionId, "Capture deleted.");
        setCheckedImageIds(new Set());
        return "session-gone";
      }
      if (result.session) {
        applyImageRemovedLocally(sessionId, image.id, result.session);
      } else {
        applyImageRemovedLocally(sessionId, image.id);
      }
      setCheckedImageIds((prev) => {
        if (!prev.has(image.id)) return prev;
        const next = new Set(prev);
        next.delete(image.id);
        return next;
      });
      return "ok";
    } catch {
      return "error";
    }
  }

  async function handleDeleteImage(image: ApplicationCaptureImage, index: number) {
    if (!selectedSessionId || !detail) return;
    if (
      !window.confirm(
        `Delete screenshot slice ${index + 1}? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingImageId(image.id);
    setToast("");
    setDetailError("");
    const status = await deleteOneImage(selectedSessionId, image);
    if (status === "ok") setToast("Screenshot deleted.");
    if (status === "error") {
      setDetailError("Could not delete screenshot.");
    }
    setDeletingImageId(null);
  }

  async function handleDeleteCheckedImages() {
    if (!selectedSessionId || !detail) return;
    const images = [...detail.images].sort((a, b) => a.sortOrder - b.sortOrder);
    const targets = images.filter((img) => checkedImageIds.has(img.id));
    if (targets.length === 0) return;
    if (
      !window.confirm(
        `Delete ${targets.length} screenshot${targets.length === 1 ? "" : "s"}? This cannot be undone.`
      )
    ) {
      return;
    }

    setBulkDeletingImages(true);
    setToast("");
    setDetailError("");
    let ok = 0;
    let fail = 0;
    // Delete bottom-up so lightbox indices stay stable for remaining opens.
    const ordered = [...targets].sort((a, b) => b.sortOrder - a.sortOrder);
    for (const image of ordered) {
      setDeletingImageId(image.id);
      const status = await deleteOneImage(selectedSessionId, image);
      if (status === "session-gone") {
        setBulkDeletingImages(false);
        setDeletingImageId(null);
        return;
      }
      if (status === "ok") ok += 1;
      else fail += 1;
    }
    setDeletingImageId(null);
    setCheckedImageIds(new Set());
    setBulkDeletingImages(false);
    if (fail === 0) {
      setToast(
        ok === 1 ? "Screenshot deleted." : `${ok} screenshots deleted.`
      );
    } else {
      setDetailError(
        `Deleted ${ok}, failed ${fail}. Some screenshots could not be removed.`
      );
    }
  }

  const dateLabel = useMemo(() => {
    if (dateYmd === formatYmdInTimezone(new Date(), timezone)) return "Today";
    return dateYmd;
  }, [dateYmd, timezone]);

  const detailImages = useMemo(
    () => [...(detail?.images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [detail?.images]
  );

  const screenshotTotalPages = Math.max(
    1,
    Math.ceil(detailImages.length / SCREENSHOTS_PER_PAGE)
  );

  const pagedScreenshotImages = useMemo(() => {
    const page = Math.min(Math.max(1, screenshotPage), screenshotTotalPages);
    const start = (page - 1) * SCREENSHOTS_PER_PAGE;
    return detailImages.slice(start, start + SCREENSHOTS_PER_PAGE).map((image, offset) => ({
      image,
      index: start + offset,
    }));
  }, [detailImages, screenshotPage, screenshotTotalPages]);

  // Keep screenshot page in range when images shrink (delete / live).
  useEffect(() => {
    setScreenshotPage((prev) => Math.min(Math.max(1, prev), screenshotTotalPages));
  }, [screenshotTotalPages]);

  // Clamp lightbox if images shrink while open.
  useEffect(() => {
    if (lightboxIndex == null) return;
    if (detailImages.length === 0) {
      setLightboxIndex(null);
      return;
    }
    if (lightboxIndex > detailImages.length - 1) {
      setLightboxIndex(detailImages.length - 1);
    }
  }, [detailImages.length, lightboxIndex]);

  // Full-view active slide → mark reviewed (not on session select alone).
  useEffect(() => {
    if (lightboxIndex == null || !selectedSessionId) return;
    const image = detailImages[lightboxIndex];
    if (!image) return;
    void markImageReviewed(selectedSessionId, image.id);
  }, [lightboxIndex, selectedSessionId, detailImages, markImageReviewed]);

  function goScreenshotPage(nextPage: number) {
    const page = Math.min(Math.max(1, nextPage), screenshotTotalPages);
    setScreenshotPage(page);
    if (!selectedSessionId) return;
    const start = (page - 1) * SCREENSHOTS_PER_PAGE;
    const image = detailImages[start];
    if (image) void markImageReviewed(selectedSessionId, image.id);
  }

  function openScreenshot(image: ApplicationCaptureImage, index: number) {
    setLightboxIndex(index);
    if (selectedSessionId) void markImageReviewed(selectedSessionId, image.id);
  }

  return (
    <div className="mt-8 flex h-[calc(100vh-10.5rem)] min-h-[36rem] flex-col gap-4">
      {/* Top — date + timezone */}
      <div className={`${saCard} flex shrink-0 flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end`}>
        <div className="min-w-[11rem]">
          <label htmlFor="sa-cap-date" className={saLabel}>
            Capture date
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              id="sa-cap-date"
              type="date"
              value={dateYmd}
              max={formatYmdInTimezone(new Date(), timezone)}
              onChange={(e) => {
                const next = e.target.value || formatYmdInTimezone(new Date(), timezone);
                setDateYmd(next);
                setToast("");
                setOutsideFilterHint("");
              }}
              className={saField}
            />
            {dateYmd !== formatYmdInTimezone(new Date(), timezone) ? (
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
          <label htmlFor="sa-cap-tz" className={saLabel}>
            Timezone
          </label>
          <select
            id="sa-cap-tz"
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
        {/* Left — profiles / owners */}
        <aside
          className={`${saCard} flex min-h-0 w-full shrink-0 flex-col overflow-hidden max-xl:max-h-[40%] xl:h-full xl:w-[260px] 2xl:w-[300px]`}
        >
          <div className="shrink-0 border-b border-slate-100 p-4">
            <form onSubmit={handleOwnerSearch} className="space-y-2">
              <label htmlFor="sa-cap-owner-search" className={saLabel}>
                Profiles
              </label>
              <div className="flex gap-2">
                <input
                  id="sa-cap-owner-search"
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
            aria-label="Capture owners"
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
                const unchecked = owner.uncheckedSessionCount || 0;
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
                        setLightboxIndex(null);
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
                          {displayCaptureOwnerName(owner)}
                        </span>
                        <UncheckedBadge
                          count={unchecked}
                          label={`${unchecked} session${unchecked === 1 ? "" : "s"} with unreviewed screenshots`}
                        />
                      </span>
                      <span className={`${saMono} truncate text-[11px] text-slate-400`}>
                        {owner.email || owner.userId}
                        {owner.captureCount
                          ? ` · ${owner.captureCount} capture${owner.captureCount === 1 ? "" : "s"}`
                          : ""}
                      </span>
                      {owner.lastCapturedAt ? (
                        <span className={`${saMono} truncate text-[10px] text-slate-400`}>
                          Last{" "}
                          {formatEstTime(owner.lastCapturedAt) ||
                            formatEstDateTime(owner.lastCapturedAt) ||
                            "—"}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        {/* Middle — sessions */}
        <section
          className={`${saCard} flex min-h-0 w-full shrink-0 flex-col overflow-hidden max-xl:max-h-[40%] xl:h-full xl:w-[320px] 2xl:w-[360px]`}
        >
          <div className="shrink-0 border-b border-slate-100 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={saEyebrow}>Application URLs</p>
                <p className={`${saMono} mt-2 text-[11px] text-slate-400`}>
                  {selectedOwner
                    ? displayCaptureOwnerName(selectedOwner)
                    : "Select a profile"}{" "}
                  · {dateLabel}
                  {sessionsLoading
                    ? " · loading…"
                    : ` · ${sessions.length} session${sessions.length === 1 ? "" : "s"}`}
                </p>
              </div>
              {sessions.length > 0 ? (
                <label
                  className={`${saMono} flex shrink-0 cursor-pointer items-center gap-1.5 pt-0.5 text-[10px] text-slate-500`}
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                    checked={
                      sessions.length > 0 &&
                      sessions.every((s) => checkedSessionIds.has(s.id))
                    }
                    ref={(el) => {
                      if (!el) return;
                      const some = sessions.some((s) => checkedSessionIds.has(s.id));
                      const all =
                        sessions.length > 0 &&
                        sessions.every((s) => checkedSessionIds.has(s.id));
                      el.indeterminate = some && !all;
                    }}
                    onChange={() => {
                      const all =
                        sessions.length > 0 &&
                        sessions.every((s) => checkedSessionIds.has(s.id));
                      setCheckedSessionIds(
                        all ? new Set() : new Set(sessions.map((s) => s.id))
                      );
                    }}
                    aria-label="Select all sessions"
                  />
                  All
                </label>
              ) : null}
            </div>
            <form onSubmit={handleSessionSearch} className="mt-3 flex gap-2">
              <input
                value={draftSessionQ}
                onChange={(e) => setDraftSessionQ(e.target.value)}
                className={saField}
                placeholder="Search URL or title…"
                spellCheck={false}
                aria-label="Search application URLs"
              />
              <button type="submit" className={`${saBtnGhost} shrink-0 px-3`}>
                Go
              </button>
              {sessionQ ? (
                <button
                  type="button"
                  className={`${saBtnGhost} shrink-0 px-2`}
                  onClick={() => {
                    setDraftSessionQ("");
                    setSessionQ("");
                  }}
                >
                  Clear
                </button>
              ) : null}
            </form>
            {checkedSessionIds.size > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={bulkDeletingSessions || Boolean(deletingSessionId)}
                  onClick={() => void handleDeleteCheckedSessions()}
                  className={`${saBtnGhost} border-rose-200 text-rose-700 hover:bg-rose-50`}
                >
                  {bulkDeletingSessions
                    ? "Deleting…"
                    : `Delete selected (${checkedSessionIds.size})`}
                </button>
                <button
                  type="button"
                  disabled={bulkDeletingSessions}
                  onClick={() => setCheckedSessionIds(new Set())}
                  className={saBtnGhost}
                >
                  Clear
                </button>
              </div>
            ) : null}
          </div>

          {sessionsError ? (
            <div className={`${saMono} ${saAlert} m-3 shrink-0 px-3 py-2 text-[11px]`} role="alert">
              {sessionsError}
            </div>
          ) : null}

          <ul
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"
            role="listbox"
            aria-label="Capture sessions"
          >
            {!selectedUserId ? (
              <li className={`${saMono} px-4 py-8 text-center text-xs text-slate-400`}>
                Select a profile to load sessions.
              </li>
            ) : sessionsLoading && sessions.length === 0 ? (
              <li className={`${saMono} px-4 py-8 text-center text-xs text-slate-400`}>
                Loading…
              </li>
            ) : sessions.length === 0 ? (
              <li className={`${saMono} px-4 py-8 text-center text-xs text-slate-400`}>
                {sessionQ
                  ? `No captures matching “${sessionQ}”.`
                  : "No captures for this day."}
              </li>
            ) : (
              sessions.map((session) => {
                const active = session.id === selectedSessionId;
                const checked = checkedSessionIds.has(session.id);
                const flashing = Boolean(flashIds[session.id]);
                const thumb = session.images[0]?.imageUrl;
                const deletingThis = deletingSessionId === session.id;
                const busy = bulkDeletingSessions || Boolean(deletingSessionId);
                const unchecked = session.uncheckedCount || 0;
                return (
                  <li key={session.id}>
                    <div
                      className={`flex gap-2 px-2 py-2 transition-colors duration-200 ${
                        active
                          ? "bg-teal-50 text-slate-900"
                          : checked
                            ? "bg-slate-50 text-slate-900"
                            : "text-slate-700 hover:bg-slate-50"
                      } ${flashing ? "sa-live-flash" : ""}`}
                    >
                      <label className="flex shrink-0 items-start pt-2">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                          checked={checked}
                          disabled={busy}
                          onChange={() => toggleCheckedSession(session.id)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Select ${captureSessionTitle(session)}`}
                        />
                      </label>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          setSelectedSessionId(session.id);
                          setToast("");
                        }}
                        className="flex min-w-0 flex-1 gap-3 px-1 py-1 text-left"
                      >
                        <CaptureThumb
                          src={thumb}
                          alt=""
                          className="h-14 w-20 shrink-0 rounded-lg"
                          onExpire={() => void refreshSignedUrls(session.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span
                              className={`min-w-0 flex-1 truncate text-sm font-medium ${
                                active ? "text-teal-900" : "text-slate-900"
                              }`}
                            >
                              {captureSessionTitle(session)}
                            </span>
                            <UncheckedBadge
                              count={unchecked}
                              label={`${unchecked} unreviewed screenshot${unchecked === 1 ? "" : "s"}`}
                            />
                          </span>
                          <span className={`${saMono} mt-0.5 block truncate text-[11px] text-slate-400`}>
                            {hostnameFromCaptureUrl(session.tabUrl)}
                          </span>
                          <span className={`${saMono} mt-1 block text-[11px] text-slate-400`}>
                            {formatEstTime(captureSessionActivityIso(session)) ||
                              formatEstDateTime(captureSessionActivityIso(session)) ||
                              "—"}
                            <span className="mx-1.5 opacity-40">·</span>
                            {session.sliceCount} slice{session.sliceCount === 1 ? "" : "s"}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        title="Delete URL session"
                        aria-label={`Delete URL session ${captureSessionTitle(session)}`}
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

        {/* Right — screenshots (paginated) */}
        <section className={`${saCard} flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden xl:h-full`}>
          <div className="shrink-0 border-b border-slate-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={saEyebrow}>Screenshots</p>
                <h2 className={`${saDisplay} mt-2 truncate text-lg font-bold text-slate-900`}>
                  {detail
                    ? captureSessionTitle(detail)
                    : detailLoading
                      ? "Loading…"
                      : selectedSessionId
                        ? "Capture"
                        : "Select a session"}
                </h2>
                {detail?.tabUrl ? (
                  <a
                    href={detail.tabUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${saMono} mt-1 block truncate text-xs text-teal-700 hover:underline`}
                  >
                    {detail.tabUrl}
                  </a>
                ) : null}
              </div>
              {detailImages.length > 0 ? (
                <label
                  className={`${saMono} flex shrink-0 cursor-pointer items-center gap-1.5 pt-1 text-[10px] text-slate-500`}
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                    checked={
                      detailImages.length > 0 &&
                      detailImages.every((img) => checkedImageIds.has(img.id))
                    }
                    ref={(el) => {
                      if (!el) return;
                      const some = detailImages.some((img) => checkedImageIds.has(img.id));
                      const all =
                        detailImages.length > 0 &&
                        detailImages.every((img) => checkedImageIds.has(img.id));
                      el.indeterminate = some && !all;
                    }}
                    onChange={() => {
                      const all =
                        detailImages.length > 0 &&
                        detailImages.every((img) => checkedImageIds.has(img.id));
                      setCheckedImageIds(
                        all ? new Set() : new Set(detailImages.map((img) => img.id))
                      );
                    }}
                    aria-label="Select all screenshots"
                  />
                  All
                </label>
              ) : null}
            </div>
            {checkedImageIds.size > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={bulkDeletingImages || Boolean(deletingImageId)}
                  onClick={() => void handleDeleteCheckedImages()}
                  className={`${saBtnGhost} border-rose-200 text-rose-700 hover:bg-rose-50`}
                >
                  {bulkDeletingImages
                    ? "Deleting…"
                    : `Delete selected (${checkedImageIds.size})`}
                </button>
                <button
                  type="button"
                  disabled={bulkDeletingImages}
                  onClick={() => setCheckedImageIds(new Set())}
                  className={saBtnGhost}
                >
                  Clear
                </button>
              </div>
            ) : null}
          </div>

          {detail ? (
            <div
              className={`${saMono} flex shrink-0 flex-wrap gap-x-4 gap-y-1 border-b border-slate-100 px-4 py-3 text-[11px] text-slate-500`}
            >
              <span>
                {formatEstDateTime(detail.capturedAt) || detail.capturedAt || "—"}
              </span>
              <span>
                {detail.sliceCount} slice{detail.sliceCount === 1 ? "" : "s"}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 font-medium capitalize ${statusBadgeClass(detail.status)}`}
              >
                {detail.status}
              </span>
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4">
            {detailError ? (
              <p className={`${saAlert} ${saMono} px-4 py-3 text-xs`} role="alert">
                {detailError}
              </p>
            ) : detailLoading && !detail ? (
              <div className="min-h-0 flex-1 animate-pulse rounded-xl bg-slate-200" aria-busy="true" />
            ) : !selectedSessionId ? (
              <p className={`${saMono} text-xs text-slate-500`}>
                Pick a session to review grayscale screenshot slices.
              </p>
            ) : detailImages.length === 0 ? (
              <p className={`${saMono} text-xs text-slate-500`}>
                No screenshot slices on this session.
              </p>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                {pagedScreenshotImages.map(({ image, index }) => {
                  const deletingThis = deletingImageId === image.id;
                  const checked = checkedImageIds.has(image.id);
                  const busy = bulkDeletingImages || Boolean(deletingImageId);
                  const unread = isCaptureImageUnread(image);
                  return (
                    <div
                      key={image.id}
                      className={`group flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-white transition ${
                        checked
                          ? "border-teal-300 ring-1 ring-teal-100"
                          : unread
                            ? "border-amber-300 ring-1 ring-amber-100"
                            : "border-slate-200 hover:border-teal-300"
                      }`}
                    >
                      <div
                        className={`${saMono} flex shrink-0 items-center justify-between gap-2 px-3 py-2 text-[11px] text-slate-400`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                            checked={checked}
                            disabled={busy}
                            onChange={() => toggleCheckedImage(image.id)}
                            aria-label={`Select slice ${index + 1}`}
                          />
                          <button
                            type="button"
                            onClick={() => openScreenshot(image, index)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="inline-flex items-center gap-2">
                              <span>
                                Slice {index + 1} of {detailImages.length}
                              </span>
                              {unread ? (
                                <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                                  New
                                </span>
                              ) : null}
                            </span>
                            <span className="ml-2 text-teal-700 opacity-0 transition group-hover:opacity-100">
                              Open full size
                            </span>
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleDeleteImage(image, index)}
                          className={`${saBtnGhost} h-7 shrink-0 border-rose-200 px-2 text-[10px] text-rose-700 hover:bg-rose-50`}
                        >
                          {deletingThis ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => openScreenshot(image, index)}
                        className={`relative min-h-0 flex-1 overflow-hidden p-2 ${
                          unread ? "bg-amber-50/80" : "bg-slate-50"
                        }`}
                      >
                        <CaptureThumb
                          src={image.imageUrl}
                          alt={`${captureSessionTitle(detail!)} slice ${index + 1}`}
                          fit="contain"
                          fill
                          onExpire={() => void refreshSignedUrls(detail!.id)}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {detailImages.length > 0 ? (
            <div
              className={`${saMono} flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500`}
            >
              <span>
                Page {Math.min(screenshotPage, screenshotTotalPages)} of {screenshotTotalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={saBtnGhost}
                  disabled={screenshotPage <= 1}
                  onClick={() => goScreenshotPage(screenshotPage - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className={saBtnGhost}
                  disabled={screenshotPage >= screenshotTotalPages}
                  onClick={() => goScreenshotPage(screenshotPage + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {lightboxIndex != null && detailImages.length > 0 ? (
        <Lightbox
          images={detailImages}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          onImageExpire={
            detail ? () => void refreshSignedUrls(detail.id) : undefined
          }
          onDeleteImage={(image, index) => void handleDeleteImage(image, index)}
          deleting={bulkDeletingImages || Boolean(deletingImageId)}
        />
      ) : null}
    </div>
  );
}
