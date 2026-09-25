"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { AUTH_LINKS } from "@/lib/constants";
import { ApiError, getApiErrorMessage } from "@/lib/auth-api";
import {
  deliverResumeArchive,
  downloadDeliverFiles,
  getRemoteDelivery,
  isRemoteDeliveryTerminal,
  remoteDeliveryUiState,
  remoteDevicesApi,
  type RemoteDelivery,
  type RemoteDevice,
  type ResumeDeliverMode,
} from "@/lib/remote-devices-api";

const Modal = dynamic(() => import("@/components/ui/Modal"), { ssr: false });

const REMOTE_SETTINGS_HREF = `${AUTH_LINKS.dashboard}#remote-computers`;
const REMOTE_POLL_MS = 2500;

export type ResumeDownloadFeedback = {
  tone: "ok" | "err" | "pending";
  text: string;
};

type ResumeDownloadChooserProps = {
  open: boolean;
  archiveId: string | null | undefined;
  onClose: () => void;
  /** Called after Here downloads finish or as Remote delivery status changes. */
  onFeedback?: (feedback: ResumeDownloadFeedback) => void;
  defaultIncludePdf?: boolean;
  defaultIncludeDocx?: boolean;
  title?: string;
};

export default function ResumeDownloadChooser({
  open,
  archiveId,
  onClose,
  onFeedback,
  defaultIncludePdf = true,
  defaultIncludeDocx = true,
  title = "Download resume",
}: ResumeDownloadChooserProps) {
  const [mode, setMode] = useState<ResumeDeliverMode>("here");
  const [includePdf, setIncludePdf] = useState(defaultIncludePdf);
  const [includeDocx, setIncludeDocx] = useState(defaultIncludeDocx);
  const [devices, setDevices] = useState<RemoteDevice[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [tracking, setTracking] = useState<RemoteDelivery | null>(null);
  const [pollError, setPollError] = useState("");
  const pollStopRef = useRef(false);
  const wasOpenRef = useRef(false);
  const lastFeedbackRef = useRef<ResumeDownloadFeedback | null>(null);
  const onFeedbackRef = useRef(onFeedback);
  onFeedbackRef.current = onFeedback;

  const activeDevices = useMemo(
    () => devices.filter((d) => !d.revokedAt),
    [devices]
  );

  const defaultDeviceId = useMemo(() => {
    const preferred = activeDevices.find((d) => d.isDefault) ?? activeDevices[0];
    return preferred?.id ?? "";
  }, [activeDevices]);

  const trackingUi = tracking ? remoteDeliveryUiState(tracking) : null;
  const trackingDone = tracking ? isRemoteDeliveryTerminal(tracking) : false;

  const loadDevices = useCallback(async () => {
    setLoadingDevices(true);
    setError("");
    try {
      const items = await remoteDevicesApi.list();
      setDevices(items.filter((d) => !d.revokedAt));
    } catch (err) {
      setDevices([]);
      setError(getApiErrorMessage(err, "Could not load remote computers."));
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  // Only reset when the modal opens (false → true), not on every parent re-render.
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    const justClosed = !open && wasOpenRef.current;
    wasOpenRef.current = open;

    if (justClosed) {
      pollStopRef.current = true;
      lastFeedbackRef.current = null;
      setTracking(null);
      setPollError("");
      setSubmitting(false);
      setError("");
      return;
    }

    if (!justOpened) return;

    pollStopRef.current = false;
    lastFeedbackRef.current = null;
    setMode("here");
    setIncludePdf(defaultIncludePdf);
    setIncludeDocx(defaultIncludeDocx);
    setError("");
    setSubmitting(false);
    setTracking(null);
    setPollError("");
    void loadDevices();
  }, [open, defaultIncludePdf, defaultIncludeDocx, loadDevices]);

  useEffect(() => {
    if (!open || tracking) return;
    setDeviceId((current) => {
      if (current && activeDevices.some((d) => d.id === current)) return current;
      return defaultDeviceId;
    });
  }, [open, tracking, activeDevices, defaultDeviceId]);

  useEffect(() => {
    if (!open || !tracking?.deliveryId || trackingDone) return;

    pollStopRef.current = false;
    let cancelled = false;
    let timer: number | null = null;
    const deliveryId = tracking.deliveryId;

    const tick = async () => {
      if (cancelled || pollStopRef.current) return;
      try {
        const next = await getRemoteDelivery(deliveryId);
        if (cancelled || pollStopRef.current) return;
        setPollError("");

        setTracking((prev) => {
          const unchanged =
            !!prev &&
            prev.status === next.status &&
            prev.message === next.message &&
            prev.error === next.error &&
            prev.isTerminal === next.isTerminal &&
            prev.isSuccess === next.isSuccess &&
            prev.deviceName === next.deviceName;
          return unchanged ? prev : next;
        });

        // Publish feedback outside setState; skip identical copy.
        const ui = remoteDeliveryUiState(next);
        const text = ui.detail || ui.headline;
        const tone = ui.tone === "pending" ? "pending" : ui.tone;
        const last = lastFeedbackRef.current;
        if (!last || last.tone !== tone || last.text !== text) {
          lastFeedbackRef.current = { tone, text };
          onFeedbackRef.current?.({ tone, text });
        }

        if (isRemoteDeliveryTerminal(next)) return;
      } catch (err) {
        if (cancelled || pollStopRef.current) return;
        setPollError(getApiErrorMessage(err, "Could not refresh delivery status."));
      }
      if (cancelled || pollStopRef.current) return;
      timer = window.setTimeout(() => {
        void tick();
      }, REMOTE_POLL_MS);
    };

    timer = window.setTimeout(() => {
      void tick();
    }, REMOTE_POLL_MS);

    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [open, tracking?.deliveryId, trackingDone]);

  function handleClose() {
    pollStopRef.current = true;
    onClose();
  }

  async function handleSubmit() {
    const id = archiveId?.trim();
    if (!id || submitting || tracking) return;

    if (!includePdf && !includeDocx) {
      setError("Select at least one format (PDF or DOCX).");
      return;
    }

    if (mode === "remote" && activeDevices.length === 0) {
      setError("Add a remote computer in settings before using remote download.");
      return;
    }

    setSubmitting(true);
    setError("");
    setPollError("");

    try {
      const result = await deliverResumeArchive(id, {
        mode,
        deviceId: mode === "remote" ? deviceId || undefined : undefined,
        includePdf,
        includeDocx,
      });

      if (result.mode === "here") {
        await downloadDeliverFiles(result);
        onFeedback?.({ tone: "ok", text: "Download started on this device." });
        handleClose();
        return;
      }

      if (!result.deliveryId) {
        throw new ApiError("Backend did not return a delivery id.", 502);
      }

      // 202 is queued — not finished. Track until isTerminal.
      const initial: RemoteDelivery = {
        deliveryId: result.deliveryId,
        deviceId: result.deviceId,
        deviceName: result.deviceName || "remote computer",
        archiveId: result.archiveId || id,
        status: result.status || "pending",
        message:
          result.message ||
          `Queued for ${result.deviceName || "remote computer"} — waiting for the remote computer agent to pick up`,
        isTerminal: result.isTerminal ?? false,
        isSuccess: result.isSuccess ?? false,
        expiresAt: result.expiresAt ?? null,
      };

      setTracking(initial);
      const ui = remoteDeliveryUiState(initial);
      const feedback = {
        tone: "pending" as const,
        text: ui.detail || ui.headline,
      };
      lastFeedbackRef.current = feedback;
      onFeedback?.(feedback);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && mode === "remote") {
        setError("No remote computer registered. Add one in settings, then try again.");
        return;
      }
      setError(getApiErrorMessage(err, "Could not deliver resume."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={title} className="max-w-lg" priority>
      <div className="space-y-5 px-6 py-5">
        {tracking && trackingUi ? (
          <RemoteDeliveryStatusPanel
            delivery={tracking}
            ui={trackingUi}
            pollError={pollError}
            onDone={handleClose}
            onClose={handleClose}
          />
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Choose where this archived resume should go.
            </p>

            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
                <input
                  type="radio"
                  name="resume-download-mode"
                  className="mt-1"
                  checked={mode === "here"}
                  onChange={() => setMode("here")}
                  disabled={submitting}
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                    Here download
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                    Save on this browser / device (current behavior).
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
                <input
                  type="radio"
                  name="resume-download-mode"
                  className="mt-1"
                  checked={mode === "remote"}
                  onChange={() => setMode("remote")}
                  disabled={submitting}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                    Remote computer download
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                    Queue delivery to a registered PC running remote-agent. No click needed on that
                    PC.
                  </span>

                  {mode === "remote" ? (
                    <div className="mt-3 space-y-2">
                      {loadingDevices ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">Loading devices…</p>
                      ) : activeDevices.length === 0 ? (
                        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                          No remote computers yet.{" "}
                          <Link
                            href={REMOTE_SETTINGS_HREF}
                            className="font-semibold underline-offset-2 hover:underline"
                            onClick={handleClose}
                          >
                            Add a remote computer
                          </Link>
                        </div>
                      ) : (
                        <div>
                          <label
                            htmlFor="remote-device-select"
                            className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
                          >
                            Device
                          </label>
                          <select
                            id="remote-device-select"
                            value={deviceId}
                            onChange={(e) => setDeviceId(e.target.value)}
                            disabled={submitting}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                          >
                            {activeDevices.map((device) => (
                              <option key={device.id} value={device.id}>
                                {device.name}
                                {device.isDefault ? " (default)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ) : null}
                </span>
              </label>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={includePdf}
                  onChange={(e) => setIncludePdf(e.target.checked)}
                  disabled={submitting}
                />
                PDF
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={includeDocx}
                  onChange={(e) => setIncludeDocx(e.target.checked)}
                  disabled={submitting}
                />
                DOCX
              </label>
            </div>

            {error ? (
              <div
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
                role="alert"
              >
                {error}
                {error.toLowerCase().includes("remote computer") ? (
                  <div className="mt-2">
                    <Link
                      href={REMOTE_SETTINGS_HREF}
                      className="font-semibold underline-offset-2 hover:underline"
                      onClick={handleClose}
                    >
                      Open remote computer settings
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={
                  submitting ||
                  !archiveId?.trim() ||
                  (mode === "remote" && activeDevices.length === 0)
                }
                onClick={() => void handleSubmit()}
              >
                {submitting
                  ? mode === "remote"
                    ? "Queuing…"
                    : "Downloading…"
                  : mode === "remote"
                    ? "Send to remote"
                    : "Download here"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function RemoteDeliveryStatusPanel({
  delivery,
  ui,
  pollError,
  onDone,
  onClose,
}: {
  delivery: RemoteDelivery;
  ui: ReturnType<typeof remoteDeliveryUiState>;
  pollError: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const done = isRemoteDeliveryTerminal(delivery);
  const bannerClass =
    ui.tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
      : ui.tone === "err"
        ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
        : "border-orange-500/25 bg-orange-500/10 text-orange-900 dark:text-orange-100";

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border px-4 py-3 ${bannerClass}`} role="status" aria-live="polite">
        <div className="flex items-start gap-3">
          {ui.spinning ? (
            <span
              className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-sm font-semibold">{ui.headline}</p>
            {ui.detail && ui.detail !== ui.headline ? (
              <p className="mt-1 text-sm opacity-90">{ui.detail}</p>
            ) : null}
            <p className="mt-2 text-xs opacity-70">
              Device: <span className="font-semibold">{delivery.deviceName}</span>
              {" · "}
              Status: <span className="font-mono">{delivery.status}</span>
            </p>
          </div>
        </div>
      </div>

      {pollError && !done ? (
        <p className="text-xs text-amber-700 dark:text-amber-300" role="alert">
          {pollError} Retrying…
        </p>
      ) : null}

      {!done ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Updating every few seconds. Leave this open until the remote PC finishes — do not expect a
          download in this browser.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {done ? (
          <Button type="button" size="sm" onClick={onDone}>
            Done
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
        {ui.tone === "err" ? (
          <Link
            href={REMOTE_SETTINGS_HREF}
            className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.05]"
            onClick={onClose}
          >
            Remote computer settings
          </Link>
        ) : null}
      </div>
    </div>
  );
}
