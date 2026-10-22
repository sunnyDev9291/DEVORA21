"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  saAlert,
  saBtnGhost,
  saBtnPrimary,
  saCardInteractive,
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
  captureSessionTitle,
  hostnameFromCaptureUrl,
  type ApplicationCaptureImage,
} from "@/lib/application-captures-api";
import { formatEstDateTime } from "@/lib/format-est-datetime";
import {
  displayCaptureOwnerName,
  superAdminApplicationCapturesApi,
  type AdminApplicationCaptureSession,
  type ApplicationCaptureOwner,
} from "@/lib/super-admin-application-captures-api";

const PAGE_LIMIT = 25;

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

function DetailDrawer({
  session,
  loading,
  error,
  deleting,
  onClose,
  onDelete,
  onOpenLightbox,
  onImageExpire,
}: {
  session: AdminApplicationCaptureSession | null;
  loading: boolean;
  error: string;
  deleting: boolean;
  onClose: () => void;
  onDelete: () => void;
  onOpenLightbox: (index: number) => void;
  onImageExpire?: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!session && !loading) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session, loading, onClose]);

  if (!session && !loading && !error) return null;

  const images = [...(session?.images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const ownerLabel = session?.owner
    ? displayCaptureOwnerName(session.owner)
    : session?.userId
      ? session.userId.slice(0, 8) + "…"
      : "—";

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        aria-label="Close capture detail"
        onClick={onClose}
      />
      <aside
        className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-[#f8fafc] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className={saEyebrow}>Capture session</p>
            <h2 id={titleId} className={`${saDisplay} mt-1 truncate text-xl font-bold text-slate-900`}>
              {session
                ? captureSessionTitle(session)
                : loading
                  ? "Loading…"
                  : "Capture"}
            </h2>
            {session?.tabUrl ? (
              <a
                href={session.tabUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${saMono} mt-1 block truncate text-xs text-teal-700 hover:underline`}
              >
                {session.tabUrl}
              </a>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className={saBtnGhost} aria-label="Close">
            Close
          </button>
        </div>

        {session ? (
          <div
            className={`${saMono} flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-200 px-5 py-3 text-[11px] text-slate-500`}
          >
            <span>
              Owner · <span className="font-semibold text-slate-700">{ownerLabel}</span>
              {session.owner?.email ? (
                <span className="ml-1 text-slate-400">({session.owner.email})</span>
              ) : null}
            </span>
            <span>
              {formatEstDateTime(session.capturedAt) || session.capturedAt || "—"}
            </span>
            <span>
              {session.sliceCount} slice{session.sliceCount === 1 ? "" : "s"}
            </span>
            <span
              className={`rounded-md px-2 py-0.5 font-medium capitalize ${statusBadgeClass(session.status)}`}
            >
              {session.status}
            </span>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-4 animate-pulse" aria-busy="true">
              <div className="h-48 rounded-xl bg-slate-200" />
              <div className="h-48 rounded-xl bg-slate-200" />
            </div>
          ) : error ? (
            <p className={`${saAlert} ${saMono} px-4 py-3 text-xs`} role="alert">
              {error}
            </p>
          ) : images.length === 0 ? (
            <p className={`${saMono} text-xs text-slate-500`}>No screenshot slices on this session.</p>
          ) : (
            <div className="space-y-4">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => onOpenLightbox(index)}
                  className="group block w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-teal-300"
                >
                  <div
                    className={`${saMono} flex items-center justify-between px-3 py-2 text-[11px] text-slate-400`}
                  >
                    <span>Slice {index + 1}</span>
                    <span className="opacity-0 transition group-hover:opacity-100 text-teal-700">
                      Open full size
                    </span>
                  </div>
                  <CaptureThumb
                    src={image.imageUrl}
                    alt={`${session ? captureSessionTitle(session) : "Capture"} slice ${index + 1}`}
                    fit="contain"
                    className="max-h-[70vh] w-full bg-slate-50"
                    onExpire={onImageExpire}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {session ? (
          <div className="border-t border-slate-200 px-5 py-4">
            <button
              type="button"
              disabled={deleting}
              onClick={onDelete}
              className={`${saBtnGhost} w-full border-rose-200 text-rose-700 hover:bg-rose-50`}
            >
              {deleting ? "Deleting…" : "Delete capture"}
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

type SuperAdminApplicationCapturesGalleryProps = {
  initialUserId?: string;
  initialQ?: string;
};

export default function SuperAdminApplicationCapturesGallery({
  initialUserId = "",
  initialQ = "",
}: SuperAdminApplicationCapturesGalleryProps) {
  const [owners, setOwners] = useState<ApplicationCaptureOwner[]>([]);
  const [sessions, setSessions] = useState<AdminApplicationCaptureSession[]>([]);
  const [userId, setUserId] = useState(initialUserId);
  const [qInput, setQInput] = useState(initialQ);
  const [q, setQ] = useState(initialQ);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminApplicationCaptureSession | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const urlRefreshAttemptedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await superAdminApplicationCapturesApi.listOwners();
        if (!cancelled) setOwners(list);
      } catch {
        if (!cancelled) setOwners([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadList = useCallback(
    async (nextPage: number, opts?: { userId?: string; q?: string }) => {
      const filterUserId = opts?.userId ?? userId;
      const filterQ = opts?.q ?? q;
      setListLoading(true);
      setListError("");
      urlRefreshAttemptedRef.current.clear();
      try {
        const result = await superAdminApplicationCapturesApi.listSessions({
          page: nextPage,
          limit: PAGE_LIMIT,
          userId: filterUserId || undefined,
          q: filterQ || undefined,
        });
        setSessions(result.sessions);
        setPage(result.page);
        setTotalPages(Math.max(1, result.totalPages));
        setTotal(result.total);
      } catch (err) {
        setListError(getApiErrorMessage(err, "Could not load application captures."));
        setSessions([]);
      } finally {
        setListLoading(false);
      }
    },
    [userId, q]
  );

  useEffect(() => {
    void loadList(1);
  }, [loadList]);

  const openDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    setLightboxIndex(null);
    urlRefreshAttemptedRef.current.delete(id);
    try {
      const session = await superAdminApplicationCapturesApi.getSession(id);
      setDetail(session);
    } catch (err) {
      setDetailError(getApiErrorMessage(err, "Could not load capture detail."));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const refreshSignedUrls = useCallback(async (id: string) => {
    if (urlRefreshAttemptedRef.current.has(id)) return;
    urlRefreshAttemptedRef.current.add(id);
    try {
      const session = await superAdminApplicationCapturesApi.getSession(id);
      setDetail((prev) => (prev?.id === id ? session : prev));
      setSessions((prev) =>
        prev.map((row) =>
          row.id === id
            ? {
                ...row,
                images: session.images.slice(0, 1),
                sliceCount: session.sliceCount,
                status: session.status,
                pageTitle: session.pageTitle,
                owner: session.owner,
              }
            : row
        )
      );
    } catch {
      // placeholder remains
    }
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
    setDetailError("");
    setLightboxIndex(null);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!selectedId || !detail) return;
    const label = captureSessionTitle(detail);
    if (!window.confirm(`Delete “${label}”? Soft-deletes this capture session.`)) {
      return;
    }
    setDeleting(true);
    try {
      await superAdminApplicationCapturesApi.deleteSession(selectedId);
      closeDetail();
      const nextPage = sessions.length <= 1 && page > 1 ? page - 1 : page;
      await loadList(nextPage);
    } catch (err) {
      setDetailError(getApiErrorMessage(err, "Could not delete capture."));
    } finally {
      setDeleting(false);
    }
  }, [selectedId, detail, closeDetail, loadList, page, sessions.length]);

  const applySearch = (event: FormEvent) => {
    event.preventDefault();
    setQ(qInput.trim());
    setPage(1);
  };

  const detailImages = [...(detail?.images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="mt-8 space-y-5">
      <form
        onSubmit={applySearch}
        className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="sa-captures-owner" className={saLabel}>
            Owner
          </label>
          <select
            id="sa-captures-owner"
            className={saField}
            value={userId}
            onChange={(event) => {
              setUserId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All owners</option>
            {owners.map((owner) => (
              <option key={owner.userId} value={owner.userId}>
                {displayCaptureOwnerName(owner)}
                {owner.captureCount ? ` (${owner.captureCount})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[14rem] flex-[2]">
          <label htmlFor="sa-captures-q" className={saLabel}>
            Search
          </label>
          <input
            id="sa-captures-q"
            className={saField}
            value={qInput}
            onChange={(event) => setQInput(event.target.value)}
            placeholder="URL, title, client id, owner email…"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={saBtnPrimary}>
            Search
          </button>
          <button
            type="button"
            className={saBtnGhost}
            disabled={listLoading}
            onClick={() => void loadList(page)}
          >
            {listLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </form>

      {(userId || q) && (
        <div className="flex flex-wrap items-center gap-2">
          {userId ? (
            <span className={saChipActive}>
              Owner · {owners.find((o) => o.userId === userId)
                ? displayCaptureOwnerName(owners.find((o) => o.userId === userId)!)
                : `${userId.slice(0, 8)}…`}
            </span>
          ) : null}
          {q ? <span className={saChip}>q · {q}</span> : null}
          <button
            type="button"
            className={saBtnGhost}
            onClick={() => {
              setUserId("");
              setQInput("");
              setQ("");
              setPage(1);
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      {listError ? (
        <p className={`${saAlert} ${saMono} px-4 py-3 text-xs`} role="alert">
          {listError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`${saMono} text-[11px] text-slate-400`}>
          {total} capture{total === 1 ? "" : "s"}
          {listLoading ? " · loading…" : ""}
        </p>
      </div>

      {listLoading && sessions.length === 0 ? (
        <div className="space-y-3 animate-pulse" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-200/80" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className={`${saCardInteractive} p-6`}>
          <p className={saEyebrow}>Empty</p>
          <p className={`${saDisplay} mt-3 text-lg font-bold text-slate-900`}>No captures yet</p>
          <p className={`${saMono} mt-2 max-w-lg text-xs leading-relaxed text-slate-500`}>
            When a user enables the Devora21 Capture extension and clicks Submit on an apply page,
            screenshots upload here automatically.
          </p>
        </div>
      ) : (
        <ul className="space-y-3" role="list">
          {sessions.map((session) => {
            const thumb = session.images[0]?.imageUrl;
            const host = hostnameFromCaptureUrl(session.tabUrl);
            const title = captureSessionTitle(session);
            const ownerLabel = session.owner
              ? displayCaptureOwnerName(session.owner)
              : session.userId
                ? session.userId.slice(0, 8) + "…"
                : "—";
            return (
              <li key={session.id}>
                <button
                  type="button"
                  onClick={() => void openDetail(session.id)}
                  className={`${saCardInteractive} flex w-full gap-4 p-3 text-left`}
                >
                  <CaptureThumb
                    src={thumb}
                    alt=""
                    className="h-20 w-28 shrink-0 rounded-xl"
                    onExpire={() => void refreshSignedUrls(session.id)}
                  />
                  <div className="min-w-0 flex-1 py-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`${saDisplay} truncate text-base font-bold text-slate-900`}>
                        {title}
                      </p>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ${statusBadgeClass(session.status)}`}
                      >
                        {session.status}
                      </span>
                    </div>
                    <p className={`${saMono} mt-1 truncate text-[11px] text-slate-500`}>
                      {ownerLabel}
                      {session.owner?.email && session.owner.email !== ownerLabel
                        ? ` · ${session.owner.email}`
                        : ""}
                    </p>
                    <p className={`${saMono} mt-1 truncate text-xs text-slate-600`}>{host}</p>
                    <p className={`${saMono} mt-2 text-[11px] text-slate-400`}>
                      {formatEstDateTime(session.capturedAt) || session.capturedAt || "—"}
                      <span className="mx-2 opacity-40">·</span>
                      {session.sliceCount} slice{session.sliceCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={`${saMono} text-[11px] text-slate-400`}>
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={saBtnGhost}
              disabled={listLoading || page <= 1}
              onClick={() => void loadList(page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className={saBtnGhost}
              disabled={listLoading || page >= totalPages}
              onClick={() => void loadList(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {(selectedId || detailLoading || detailError) && (
        <DetailDrawer
          session={detail}
          loading={detailLoading}
          error={detailError}
          deleting={deleting}
          onClose={closeDetail}
          onDelete={() => void handleDelete()}
          onOpenLightbox={(index) => setLightboxIndex(index)}
          onImageExpire={
            selectedId ? () => void refreshSignedUrls(selectedId) : undefined
          }
        />
      )}

      {lightboxIndex != null && detailImages.length > 0 ? (
        <Lightbox
          images={detailImages}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          onImageExpire={
            selectedId ? () => void refreshSignedUrls(selectedId) : undefined
          }
        />
      ) : null}
    </div>
  );
}
