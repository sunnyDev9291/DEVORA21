"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { getApiErrorMessage } from "@/lib/auth-api";
import {
  captureSessionTitle,
  deleteApplicationCapture,
  formatCaptureTime,
  getApplicationCapture,
  hostnameFromCaptureUrl,
  listApplicationCaptures,
  type ApplicationCaptureImage,
  type ApplicationCaptureSession,
} from "@/lib/application-captures-api";
import { ui } from "@/lib/ui-styles";

const PAGE_LIMIT = 20;

function statusBadgeClass(status: string): string {
  const key = status.toLowerCase();
  if (key === "uploaded" || key === "ready" || key === "complete") {
    return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
  }
  if (key === "deleted") {
    return "bg-stone-500/15 text-stone-600 dark:text-stone-400";
  }
  if (key === "failed" || key === "error") {
    return "bg-tomato-500/15 text-tomato-800 dark:text-tomato-300";
  }
  return "bg-orange-500/15 text-orange-800 dark:text-orange-300";
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
  /** Signed URL may 403 — parent should re-fetch session detail once. */
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
        className={`flex items-center justify-center bg-stone-200/80 text-stone-500 dark:bg-white/[0.06] dark:text-stone-500 ${className}`}
        aria-hidden
      >
        <svg className="h-8 w-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
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

const GALLERY_ZOOM_MIN = 0.5;
const GALLERY_ZOOM_MAX = 3;
const GALLERY_ZOOM_STEP = 0.25;

function clampGalleryZoom(value: number): number {
  return Math.min(
    GALLERY_ZOOM_MAX,
    Math.max(GALLERY_ZOOM_MIN, Math.round(value * 100) / 100)
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [broken, setBroken] = useState(false);
  const expireCalledRef = useRef(false);

  useEffect(() => {
    setZoom(1);
    setBroken(false);
    expireCalledRef.current = false;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [index, image?.imageUrl]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setZoom((z) => clampGalleryZoom(z + GALLERY_ZOOM_STEP));
        return;
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setZoom((z) => clampGalleryZoom(z - GALLERY_ZOOM_STEP));
        return;
      }
      if (event.key === "0") {
        event.preventDefault();
        setZoom(1);
        return;
      }
      if (event.key === "ArrowRight" && index < images.length - 1) {
        onIndexChange(index + 1);
      }
      if (event.key === "ArrowLeft" && index > 0) {
        onIndexChange(index - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, index, onClose, onIndexChange]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const delta = event.deltaY > 0 ? -GALLERY_ZOOM_STEP : GALLERY_ZOOM_STEP;
      setZoom((z) => clampGalleryZoom(z + delta));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-warm-950/90 p-4 backdrop-blur-sm animate-backdrop-enter"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="relative flex h-[min(96dvh,60rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-warm-950 shadow-2xl animate-dialog-enter"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <p id={titleId} className="text-sm font-medium text-stone-200">
            Slice {index + 1} of {images.length}
            {image.width && image.height ? (
              <span className="ml-2 text-stone-500">
                {image.width}×{image.height}
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              aria-label="Zoom out"
              disabled={zoom <= GALLERY_ZOOM_MIN}
              onClick={() => setZoom((z) => clampGalleryZoom(z - GALLERY_ZOOM_STEP))}
              className="rounded-lg px-2.5 py-1.5 text-sm text-stone-300 hover:bg-white/10 disabled:opacity-40"
            >
              −
            </button>
            <span className="min-w-[3.25rem] text-center text-xs text-stone-400">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={zoom >= GALLERY_ZOOM_MAX}
              onClick={() => setZoom((z) => clampGalleryZoom(z + GALLERY_ZOOM_STEP))}
              className="rounded-lg px-2.5 py-1.5 text-sm text-stone-300 hover:bg-white/10 disabled:opacity-40"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="rounded-lg px-2.5 py-1.5 text-xs text-stone-300 hover:bg-white/10"
            >
              Fit width
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-stone-300 hover:bg-white/10 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-black/40">
          <div className="flex min-h-full justify-center p-3">
            {!image.imageUrl || broken ? (
              <div className="flex min-h-[12rem] w-full items-center justify-center text-stone-500">
                Image unavailable
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- signed Backblaze URLs
              <img
                src={image.imageUrl}
                alt={`Capture slice ${index + 1}`}
                className="block h-auto max-w-none rounded-lg grayscale"
                style={{ width: `${zoom * 100}%` }}
                draggable={false}
                onError={() => {
                  setBroken(true);
                  if (!expireCalledRef.current && onImageExpire) {
                    expireCalledRef.current = true;
                    onImageExpire();
                  }
                }}
              />
            )}
          </div>
        </div>
        {images.length > 1 ? (
          <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
            <button
              type="button"
              disabled={index <= 0}
              onClick={() => onIndexChange(index - 1)}
              className="rounded-lg px-3 py-1.5 text-sm text-stone-300 hover:bg-white/10 disabled:opacity-40"
            >
              Previous
            </button>
            <p className="text-[11px] text-stone-500">Scroll · Ctrl/⌘+wheel · − / +</p>
            <button
              type="button"
              disabled={index >= images.length - 1}
              onClick={() => onIndexChange(index + 1)}
              className="rounded-lg px-3 py-1.5 text-sm text-stone-300 hover:bg-white/10 disabled:opacity-40"
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
  session: ApplicationCaptureSession | null;
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

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-warm-950/50 backdrop-blur-[2px] animate-backdrop-enter"
        aria-label="Close capture detail"
        onClick={onClose}
      />
      <aside
        className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-orange-200/40 bg-white shadow-2xl animate-dialog-enter dark:border-orange-500/15 dark:bg-warm-950"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-start justify-between gap-3 border-b border-orange-200/50 px-5 py-4 dark:border-white/[0.08]">
          <div className="min-w-0">
            <h2 id={titleId} className={`${ui.headingMd} truncate`}>
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
                className="mt-1 block truncate text-sm text-orange-700 underline-offset-2 hover:underline dark:text-orange-300"
              >
                {session.tabUrl}
              </a>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-white/[0.06] dark:hover:text-white"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {session ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-orange-200/40 px-5 py-3 text-xs text-stone-600 dark:border-white/[0.06] dark:text-stone-400">
            <span>{formatCaptureTime(session.capturedAt)}</span>
            <span>
              {session.sliceCount} slice{session.sliceCount === 1 ? "" : "s"}
            </span>
            <span className={`rounded-md px-2 py-0.5 font-medium capitalize ${statusBadgeClass(session.status)}`}>
              {session.status}
            </span>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-4 animate-pulse" aria-busy="true">
              <div className="h-48 rounded-xl bg-stone-200 dark:bg-white/10" />
              <div className="h-48 rounded-xl bg-stone-200 dark:bg-white/10" />
            </div>
          ) : error ? (
            <p className="text-sm text-tomato-700 dark:text-tomato-300" role="alert">
              {error}
            </p>
          ) : images.length === 0 ? (
            <p className={ui.mutedSm}>No screenshot slices on this session.</p>
          ) : (
            <div className="space-y-4">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => onOpenLightbox(index)}
                  className="group block w-full overflow-hidden rounded-xl border border-orange-200/50 bg-stone-100 text-left transition hover:border-orange-400/50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-orange-400/30"
                >
                  <div className="flex items-center justify-between px-3 py-2 text-xs text-stone-500 dark:text-stone-400">
                    <span>Slice {index + 1}</span>
                    <span className="opacity-0 transition group-hover:opacity-100">Open full size</span>
                  </div>
                  <CaptureThumb
                    src={image.imageUrl}
                    alt={`${session ? captureSessionTitle(session) : "Capture"} slice ${index + 1}`}
                    fit="contain"
                    className="max-h-[70vh] w-full bg-stone-100 dark:bg-black/30"
                    onExpire={onImageExpire}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {session ? (
          <div className="border-t border-orange-200/50 px-5 py-4 dark:border-white/[0.08]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={deleting}
              onClick={onDelete}
              className="w-full border-tomato-300/60 text-tomato-800 hover:border-tomato-400 hover:bg-tomato-50 dark:border-tomato-500/30 dark:text-tomato-300 dark:hover:bg-tomato-500/10"
            >
              {deleting ? "Deleting…" : "Delete capture"}
            </Button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

export default function ApplicationCapturesGallery() {
  const [sessions, setSessions] = useState<ApplicationCaptureSession[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApplicationCaptureSession | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  /** Avoid re-fetch loops when signed URLs stay expired. */
  const urlRefreshAttemptedRef = useRef<Set<string>>(new Set());

  const loadList = useCallback(async (nextPage: number) => {
    setListLoading(true);
    setListError("");
    urlRefreshAttemptedRef.current.clear();
    try {
      const result = await listApplicationCaptures({ page: nextPage, limit: PAGE_LIMIT });
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
  }, []);

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
      const session = await getApplicationCapture(id);
      setDetail(session);
    } catch (err) {
      setDetailError(getApiErrorMessage(err, "Could not load capture detail."));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  /** Re-fetch detail once to refresh expired Backblaze signed URLs (no loading wipe). */
  const refreshSignedUrls = useCallback(async (id: string) => {
    if (urlRefreshAttemptedRef.current.has(id)) return;
    urlRefreshAttemptedRef.current.add(id);
    try {
      const session = await getApplicationCapture(id);
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
              }
            : row
        )
      );
    } catch {
      // Keep placeholder; user can Refresh manually.
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
    if (!window.confirm(`Delete “${label}”? This cannot be undone from the gallery.`)) {
      return;
    }
    setDeleting(true);
    try {
      await deleteApplicationCapture(selectedId);
      closeDetail();
      const nextPage = sessions.length <= 1 && page > 1 ? page - 1 : page;
      await loadList(nextPage);
    } catch (err) {
      setDetailError(getApiErrorMessage(err, "Could not delete capture."));
    } finally {
      setDeleting(false);
    }
  }, [selectedId, detail, closeDetail, loadList, page, sessions.length]);

  const detailImages = [...(detail?.images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className={`${ui.page} px-4 py-10 sm:px-6 lg:px-8`}>
      <div className="mx-auto max-w-5xl animate-fade-up">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className={ui.headingLg}>Application Captures</h1>
            <p className={`mt-2 max-w-xl ${ui.muted}`}>
              Grayscale page slices auto-uploaded after Capture and Submit in the Devora21 Chrome extension.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={listLoading}
            onClick={() => void loadList(page)}
          >
            {listLoading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        {listError ? (
          <p className="mt-6 rounded-xl border border-tomato-300/50 bg-tomato-50/80 px-4 py-3 text-sm text-tomato-800 dark:border-tomato-500/30 dark:bg-tomato-500/10 dark:text-tomato-200" role="alert">
            {listError}
          </p>
        ) : null}

        {listLoading && sessions.length === 0 ? (
          <div className="mt-8 space-y-3 animate-pulse" aria-busy="true" aria-label="Loading captures">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-stone-200/80 dark:bg-white/[0.06]" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-orange-300/50 bg-orange-50/40 px-6 py-12 text-center dark:border-orange-500/20 dark:bg-orange-500/[0.04]">
            <p className={`${ui.headingSm} text-stone-800 dark:text-stone-100`}>No captures yet</p>
            <p className={`mx-auto mt-3 max-w-md ${ui.mutedSm}`}>
              Install or enable the Devora21 Capture extension. On an apply page, click{" "}
              <strong className="font-semibold">Capture and Submit</strong> — the extension scrolls,
              captures grayscale slices, and auto-uploads them. Refresh this page to see new sessions.
            </p>
          </div>
        ) : (
          <ul className="mt-8 space-y-3" role="list">
            {sessions.map((session) => {
              const thumb = session.images[0]?.imageUrl;
              const host = hostnameFromCaptureUrl(session.tabUrl);
              const title = captureSessionTitle(session);
              return (
                <li key={session.id}>
                  <button
                    type="button"
                    onClick={() => void openDetail(session.id)}
                    className="flex w-full gap-4 rounded-2xl border border-orange-200/60 bg-white/80 p-3 text-left shadow-sm transition hover:border-orange-400/50 hover:bg-orange-50/40 dark:border-orange-500/12 dark:bg-white/[0.03] dark:hover:border-orange-400/30 dark:hover:bg-white/[0.05]"
                  >
                    <CaptureThumb
                      src={thumb}
                      alt=""
                      className="h-20 w-28 shrink-0 rounded-xl"
                      onExpire={() => void refreshSignedUrls(session.id)}
                    />
                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-stone-900 dark:text-stone-50">
                          {title}
                        </p>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ${statusBadgeClass(session.status)}`}
                        >
                          {session.status}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-stone-600 dark:text-stone-400">{host}</p>
                      <p className="mt-2 text-xs text-stone-500 dark:text-stone-500">
                        {formatCaptureTime(session.capturedAt)}
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
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <p className={ui.mutedSm}>
              Page {page} of {totalPages}
              {total > 0 ? ` · ${total} total` : ""}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={listLoading || page <= 1}
                onClick={() => void loadList(page - 1)}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={listLoading || page >= totalPages}
                onClick={() => void loadList(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>

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
