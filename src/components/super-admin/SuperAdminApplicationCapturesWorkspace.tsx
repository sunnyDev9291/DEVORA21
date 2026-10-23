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
  isIsoOnYmd,
} from "@/lib/format-est-datetime";
import {
  captureSessionActivityIso,
  displayCaptureOwnerName,
  mergeCaptureSession,
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
  onExpire,
}: {
  src?: string;
  alt: string;
  className?: string;
  fit?: "cover" | "contain";
  onExpire?: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const expireCalledRef = useRef(false);

  useEffect(() => {
    setBroken(false);
    expireCalledRef.current = false;
  }, [src]);

  if (!src || broken) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className}`}
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
      className={`${fit === "contain" ? "object-contain" : "object-cover object-top"} grayscale ${className}`}
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
}: {
  images: ApplicationCaptureImage[];
  index: number;
  onClose: () => void;
  onIndexChange: (next: number) => void;
  onImageExpire?: () => void;
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

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <p id={titleId} className={`${saMono} text-xs text-slate-600`}>
            Slice {index + 1} of {images.length}
            {image.width && image.height ? (
              <span className="ml-2 text-slate-400">
                {image.width}×{image.height}
              </span>
            ) : null}
          </p>
          <button type="button" onClick={onClose} className={saBtnGhost}>
            Close
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-50 p-3">
          <CaptureThumb
            src={image.imageUrl}
            alt={`Capture slice ${index + 1}`}
            fit="contain"
            className="max-h-[75dvh] w-auto max-w-full rounded-lg"
            onExpire={onImageExpire}
          />
        </div>
        {images.length > 1 ? (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <button
              type="button"
              disabled={index <= 0}
              onClick={() => onIndexChange(index - 1)}
              className={saBtnGhost}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={index >= images.length - 1}
              onClick={() => onIndexChange(index + 1)}
              className={saBtnGhost}
            >
              Next
            </button>
          </div>
        ) : null}
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

function sessionMatchesDay(
  session: AdminApplicationCaptureSession,
  day: string,
  timeZone: string
): boolean {
  const iso = captureSessionActivityIso(session);
  if (!iso) return true;
  return isIsoOnYmd(iso, day, timeZone);
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
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    initialSessionId.trim() || null
  );

  const [detail, setDetail] = useState<AdminApplicationCaptureSession | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState("");
  const [outsideFilterHint, setOutsideFilterHint] = useState("");
  const [flashIds, setFlashIds] = useState<Record<string, number>>({});
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const urlRefreshAttemptedRef = useRef<Set<string>>(new Set());

  const selectedUserIdRef = useRef(selectedUserId);
  const dateYmdRef = useRef(dateYmd);
  const timezoneRef = useRef(timezone);
  const selectedSessionIdRef = useRef(selectedSessionId);
  const lightboxIndexRef = useRef(lightboxIndex);
  selectedUserIdRef.current = selectedUserId;
  dateYmdRef.current = dateYmd;
  timezoneRef.current = timezone;
  selectedSessionIdRef.current = selectedSessionId;
  lightboxIndexRef.current = lightboxIndex;

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
    async (userId: string, day: string, tz: string) => {
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
          page: 1,
          limit: 100,
        });

        const filtered = sortCaptureSessionsRecent(
          result.sessions.filter((session) => sessionMatchesDay(session, day, tz))
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
      return;
    }
    void loadSessions(selectedUserId, dateYmd, timezone);
  }, [selectedUserId, dateYmd, timezone, loadSessions]);

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

  const handleLiveEvent = useCallback(
    (event: ApplicationCapturesLiveEvent) => {
      if (event.kind === "ready") return;

      if (event.kind === "session.deleted") {
        const { sessionId, userId } = event;
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (selectedSessionIdRef.current === sessionId) {
          setSelectedSessionId(null);
          setDetail(null);
          setLightboxIndex(null);
          setToast("Capture deleted.");
        }
        if (userId && userId === selectedUserIdRef.current) {
          setOutsideFilterHint("");
        }
        return;
      }

      const session = event.session;
      const ownerId = session.userId;
      const openOwner = selectedUserIdRef.current;
      const openDay = dateYmdRef.current;
      const openTz = timezoneRef.current;
      const matchesOwner = Boolean(openOwner && ownerId && ownerId === openOwner);
      const matchesDay = sessionMatchesDay(session, openDay, openTz);
      const sparsePayload = session.images.length === 0 && session.sliceCount > 0;

      // Always refresh open detail for this session id; keep lightbox selection.
      if (selectedSessionIdRef.current === session.id) {
        setDetail((prev) => mergeCaptureSession(prev, session));
        setDetailError("");
        if (session.images.length > 0) {
          setLightboxIndex((idx) => {
            if (idx == null) return null;
            return Math.min(idx, session.images.length - 1);
          });
        }
        if (sparsePayload) {
          hydrateSessionDetail(session.id);
        }
      }

      if (!matchesOwner) {
        return;
      }

      if (matchesDay) {
        setSessions((prev) => {
          const existing = prev.find((s) => s.id === session.id);
          return upsertCaptureSessionList(prev, mergeCaptureSession(existing, session));
        });
        flashSession(session.id);
        setOutsideFilterHint("");
        return;
      }

      setOutsideFilterHint(
        `Live update for ${captureSessionTitle(session)} outside ${openDay}.`
      );
      flashSession(session.id);
    },
    [flashSession, hydrateSessionDetail]
  );

  const liveStatus = useApplicationCapturesLive({
    enabled: true,
    onEvent: handleLiveEvent,
  });

  useEffect(() => {
    onLiveStatusChange?.(liveStatus);
  }, [liveStatus, onLiveStatusChange]);

  function handleOwnerSearch(e: FormEvent) {
    e.preventDefault();
    setOwnerQ(draftOwnerQ.trim());
  }

  async function handleDeleteSelected() {
    if (!selectedSessionId || !detail) return;
    const label = captureSessionTitle(detail);
    if (!window.confirm(`Delete “${label}”? Soft-deletes this capture session.`)) return;

    setDeleting(true);
    setToast("");
    try {
      await superAdminApplicationCapturesApi.deleteSession(selectedSessionId);
      setToast("Capture deleted.");
      setLightboxIndex(null);
      await loadSessions(selectedUserId || "", dateYmd, timezone);
    } catch (err) {
      setDetailError(getApiErrorMessage(err, "Could not delete capture."));
    } finally {
      setDeleting(false);
    }
  }

  const dateLabel = useMemo(() => {
    if (dateYmd === formatYmdInTimezone(new Date(), timezone)) return "Today";
    return dateYmd;
  }, [dateYmd, timezone]);

  const detailImages = [...(detail?.images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

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

  return (
    <div className="mt-8 flex min-h-[74vh] flex-col gap-4">
      {/* Top — date + timezone */}
      <div className={`${saCard} flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end`}>
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
          className={`${saMono} rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-[11px] text-teal-900`}
          role="status"
        >
          {toast}
        </p>
      ) : null}

      {outsideFilterHint ? (
        <p
          className={`${saMono} rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900`}
          role="status"
        >
          {outsideFilterHint}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row xl:items-stretch">
        {/* Left — profiles / owners */}
        <aside
          className={`${saCard} flex w-full shrink-0 flex-col overflow-hidden xl:w-[260px] 2xl:w-[300px]`}
        >
          <div className="border-b border-slate-100 p-4">
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
            <div className={`${saMono} ${saAlert} m-3 px-3 py-2 text-[11px]`} role="alert">
              {ownersError}
            </div>
          ) : null}

          <ul className="min-h-0 flex-1 overflow-y-auto py-1" role="listbox" aria-label="Capture owners">
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
                      <span
                        className={`truncate text-sm font-medium ${
                          active ? "text-teal-900" : "text-slate-900"
                        }`}
                      >
                        {displayCaptureOwnerName(owner)}
                      </span>
                      <span className={`${saMono} truncate text-[11px] text-slate-400`}>
                        {owner.email || owner.userId}
                        {owner.captureCount
                          ? ` · ${owner.captureCount} capture${owner.captureCount === 1 ? "" : "s"}`
                          : ""}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        {/* Middle — sessions */}
        <section
          className={`${saCard} flex w-full shrink-0 flex-col overflow-hidden xl:w-[320px] 2xl:w-[360px]`}
        >
          <div className="border-b border-slate-100 p-4">
            <p className={saEyebrow}>Sessions</p>
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

          {sessionsError ? (
            <div className={`${saMono} ${saAlert} m-3 px-3 py-2 text-[11px]`} role="alert">
              {sessionsError}
            </div>
          ) : null}

          <ul className="min-h-0 flex-1 overflow-y-auto py-1" role="listbox" aria-label="Capture sessions">
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
                No captures for this day.
              </li>
            ) : (
              sessions.map((session) => {
                const active = session.id === selectedSessionId;
                const flashing = Boolean(flashIds[session.id]);
                const thumb = session.images[0]?.imageUrl;
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
                      className={`flex w-full gap-3 px-3 py-3 text-left transition-colors duration-200 ${
                        active
                          ? "bg-teal-50 text-slate-900"
                          : "text-slate-700 hover:bg-slate-50"
                      } ${flashing ? "sa-live-flash" : ""}`}
                    >
                      <CaptureThumb
                        src={thumb}
                        alt=""
                        className="h-14 w-20 shrink-0 rounded-lg"
                        onExpire={() => void refreshSignedUrls(session.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-sm font-medium ${
                            active ? "text-teal-900" : "text-slate-900"
                          }`}
                        >
                          {captureSessionTitle(session)}
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
                  </li>
                );
              })
            )}
          </ul>
        </section>

        {/* Right — screenshots */}
        <section className={`${saCard} flex min-w-0 flex-1 flex-col overflow-hidden`}>
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
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
            {detail ? (
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDeleteSelected()}
                className={`${saBtnGhost} shrink-0 border-rose-200 text-rose-700 hover:bg-rose-50`}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            ) : null}
          </div>

          {detail ? (
            <div
              className={`${saMono} flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-100 px-4 py-3 text-[11px] text-slate-500`}
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

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {detailError ? (
              <p className={`${saAlert} ${saMono} px-4 py-3 text-xs`} role="alert">
                {detailError}
              </p>
            ) : detailLoading && !detail ? (
              <div className="space-y-4 animate-pulse" aria-busy="true">
                <div className="h-48 rounded-xl bg-slate-200" />
                <div className="h-48 rounded-xl bg-slate-200" />
              </div>
            ) : !selectedSessionId ? (
              <p className={`${saMono} text-xs text-slate-500`}>
                Pick a session to review grayscale screenshot slices.
              </p>
            ) : detailImages.length === 0 ? (
              <p className={`${saMono} text-xs text-slate-500`}>
                No screenshot slices on this session.
              </p>
            ) : (
              <div className="space-y-4">
                {detailImages.map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setLightboxIndex(index)}
                    className="group block w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-teal-300"
                  >
                    <div
                      className={`${saMono} flex items-center justify-between px-3 py-2 text-[11px] text-slate-400`}
                    >
                      <span>Slice {index + 1}</span>
                      <span className="text-teal-700 opacity-0 transition group-hover:opacity-100">
                        Open full size
                      </span>
                    </div>
                    <CaptureThumb
                      src={image.imageUrl}
                      alt={`${captureSessionTitle(detail!)} slice ${index + 1}`}
                      fit="contain"
                      className="max-h-[70vh] w-full bg-slate-50"
                      onExpire={() => void refreshSignedUrls(detail!.id)}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
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
        />
      ) : null}
    </div>
  );
}
