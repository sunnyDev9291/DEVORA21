"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { getApiErrorMessage } from "@/lib/auth-api";
import {
  remoteDevicesApi,
  type RemoteDevice,
} from "@/lib/remote-devices-api";

const Modal = dynamic(() => import("@/components/ui/Modal"), { ssr: false });

const fieldClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function DashboardRemoteDevicesPanel() {
  const [devices, setDevices] = useState<RemoteDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createdRawSecret, setCreatedRawSecret] = useState<string | null>(null);
  const [createdWarning, setCreatedWarning] = useState("");
  const [createdName, setCreatedName] = useState("");
  const [copied, setCopied] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<RemoteDevice | null>(null);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const items = await remoteDevicesApi.list();
      setDevices(items.filter((d) => !d.revokedAt));
    } catch (err) {
      setDevices([]);
      setError(getApiErrorMessage(err, "Could not load remote computers."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError("");
    setCopied(false);
    try {
      const data = await remoteDevicesApi.create(name.trim() || "Remote PC", true);
      setCreatedRawSecret(data.rawSecret);
      setCreatedWarning(
        data.warning ||
          "Store this device secret now. It will not be shown again."
      );
      setCreatedName(data.device.name);
      setName("");
      await loadDevices();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not register remote computer."));
    } finally {
      setCreating(false);
    }
  }

  function dismissCreatedSecretModal() {
    setCreatedRawSecret(null);
    setCreatedWarning("");
    setCreatedName("");
    setCopied(false);
  }

  async function copyRawSecret() {
    if (!createdRawSecret) return;
    try {
      await navigator.clipboard.writeText(createdRawSecret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard. Select the secret and copy manually.");
    }
  }

  async function handleSetDefault(device: RemoteDevice) {
    if (busyId || device.isDefault) return;
    setBusyId(device.id);
    setError("");
    try {
      await remoteDevicesApi.setDefault(device.id);
      await loadDevices();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not set default remote computer."));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRevoke() {
    if (!revokeTarget || busyId) return;
    const id = revokeTarget.id;
    setBusyId(id);
    setError("");
    try {
      await remoteDevicesApi.revoke(id);
      setRevokeTarget(null);
      await loadDevices();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not revoke remote computer."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section
      id="remote-computers"
      className="scroll-mt-28 rounded-2xl border border-white/10 bg-navy-900/60 p-6 sm:p-8"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Remote computers</h2>
          <p className="mt-1 text-sm text-slate-400">
            Register a Windows PC running the Devora remote-agent so resume downloads can land
            there without opening a browser on that machine.
          </p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="remote-device-name" className="mb-1.5 block text-xs font-medium text-slate-400">
            Computer name
          </label>
          <input
            id="remote-device-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Office-B"
            className={fieldClass}
            maxLength={80}
            autoComplete="off"
          />
        </div>
        <Button type="submit" size="sm" disabled={creating} className="shrink-0">
          {creating ? "Registering…" : "Add remote computer"}
        </Button>
      </form>

      {error ? (
        <div
          className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-6">
        {loading ? (
          <div className="rounded-xl border border-white/10 px-4 py-10 text-center text-sm text-slate-400">
            Loading remote computers…
          </div>
        ) : devices.length === 0 ? (
          <div className="rounded-xl border border-white/10 px-4 py-10 text-center text-sm text-slate-400">
            No remote computers yet. Add one to queue resume deliveries to that PC.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Secret</th>
                  <th className="px-4 py-3 font-medium">Last seen</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {devices.map((device) => (
                  <tr key={device.id} className="align-middle">
                    <td className="px-4 py-3 font-medium text-white">
                      {device.name}
                      {device.isDefault ? (
                        <span className="ml-2 rounded-full bg-orange-500/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-orange-200">
                          Default
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-white/[0.06] px-2 py-1 font-mono text-xs text-slate-300">
                        {device.secretPrefix || "dvrd_"}…
                      </code>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                      {formatDate(device.lastSeenAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                      {formatDate(device.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {!device.isDefault ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busyId === device.id}
                            onClick={() => void handleSetDefault(device)}
                          >
                            Set default
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busyId === device.id}
                          onClick={() => setRevokeTarget(device)}
                          className="!border-red-500/40 !text-red-300 hover:!bg-red-500/10"
                        >
                          Revoke
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(createdRawSecret)}
        onClose={dismissCreatedSecretModal}
        title="Remote computer registered"
        className="max-w-xl"
        priority
      >
        <div className="space-y-4 px-6 py-5">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            {createdWarning || "Store this device secret now. It will not be shown again."}
          </div>
          {createdName ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Computer: <span className="font-semibold text-slate-700 dark:text-slate-300">{createdName}</span>
            </p>
          ) : null}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Device secret
            </p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/[0.10] dark:bg-white/[0.03]">
              <code className="block break-all font-mono text-sm text-slate-900 dark:text-white">
                {createdRawSecret}
              </code>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-slate-300">
            <p className="font-semibold text-slate-800 dark:text-slate-100">Install on that PC</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed">
              <li>Install Devora remote-agent on that Windows PC.</li>
              <li>
                Put this secret in <code className="font-mono">remote-agent/.env</code> as{" "}
                <code className="font-mono">DEVICE_SECRET</code>.
              </li>
              <li>
                Run <code className="font-mono">npm start</code> so the agent can claim queued
                deliveries.
              </li>
            </ol>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              See <code className="font-mono">remote-agent/README.md</code> in the repo for setup
              details.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={() => void copyRawSecret()}>
              {copied ? "Copied" : "Copy secret"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={dismissCreatedSecretModal}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        title="Revoke remote computer"
        className="max-w-md"
        priority
      >
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Revoke <span className="font-semibold text-slate-900 dark:text-white">{revokeTarget?.name}</span>?
            Queued deliveries to this device will stop working.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void confirmRevoke()}
              disabled={busyId === revokeTarget?.id}
              className="!bg-red-600 hover:!bg-red-500"
            >
              {busyId === revokeTarget?.id ? "Revoking…" : "Revoke"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
