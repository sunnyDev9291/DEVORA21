"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { AUTH_LINKS } from "@/lib/constants";
import { ApiError, getApiErrorMessage } from "@/lib/auth-api";
import {
  deliverResumeArchive,
  downloadDeliverFiles,
  getRemoteDelivery,
  isRemoteDeliveryTerminal,
  remoteDevicesApi,
  type RemoteDevice,
  type ResumeDeliverMode,
} from "@/lib/remote-devices-api";

const Modal = dynamic(() => import("@/components/ui/Modal"), { ssr: false });

const REMOTE_SETTINGS_HREF = `${AUTH_LINKS.dashboard}#remote-computers`;

export type ResumeDownloadFeedback = {
  tone: "ok" | "err";
  text: string;
};

type ResumeDownloadChooserProps = {
  open: boolean;
  archiveId: string | null | undefined;
  onClose: () => void;
  /** Called after Here downloads finish or Remote queues successfully. */
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

  const activeDevices = useMemo(
    () => devices.filter((d) => !d.revokedAt),
    [devices]
  );

  const defaultDeviceId = useMemo(() => {
    const preferred = activeDevices.find((d) => d.isDefault) ?? activeDevices[0];
    return preferred?.id ?? "";
  }, [activeDevices]);

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

  useEffect(() => {
    if (!open) return;
    setMode("here");
    setIncludePdf(defaultIncludePdf);
    setIncludeDocx(defaultIncludeDocx);
    setError("");
    setSubmitting(false);
    void loadDevices();
  }, [open, defaultIncludePdf, defaultIncludeDocx, loadDevices]);

  useEffect(() => {
    if (!open) return;
    setDeviceId((current) => {
      if (current && activeDevices.some((d) => d.id === current)) return current;
      return defaultDeviceId;
    });
  }, [open, activeDevices, defaultDeviceId]);

  async function handleSubmit() {
    const id = archiveId?.trim();
    if (!id || submitting) return;

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
        onClose();
        return;
      }

      const deviceName = result.deviceName || "remote computer";
      onFeedback?.({
        tone: "ok",
        text: `Queued for ${deviceName}. The file will appear there — no download in this browser.`,
      });
      onClose();

      // Optional quiet poll — surfaces failure without blocking the UI.
      void pollDeliveryQuietly(result.deliveryId, deviceName, onFeedback);
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
    <Modal open={open} onClose={onClose} title={title} className="max-w-lg" priority>
      <div className="space-y-5 px-6 py-5">
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
                Queue delivery to a registered PC running remote-agent. No click needed on that PC.
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
                        onClick={onClose}
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
                  onClick={onClose}
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
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

async function pollDeliveryQuietly(
  deliveryId: string,
  deviceName: string,
  onFeedback?: (feedback: ResumeDownloadFeedback) => void
) {
  const maxAttempts = 12;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 3000));
    try {
      const delivery = await getRemoteDelivery(deliveryId);
      if (!isRemoteDeliveryTerminal(delivery.status)) continue;
      if (delivery.status === "delivered") {
        onFeedback?.({
          tone: "ok",
          text: `Delivered to ${delivery.deviceName || deviceName}.`,
        });
      } else if (delivery.status === "failed") {
        onFeedback?.({
          tone: "err",
          text: delivery.error || `Delivery to ${deviceName} failed.`,
        });
      } else if (delivery.status === "expired") {
        onFeedback?.({
          tone: "err",
          text: `Delivery to ${deviceName} expired before the agent claimed it.`,
        });
      }
      return;
    } catch {
      return;
    }
  }
}
