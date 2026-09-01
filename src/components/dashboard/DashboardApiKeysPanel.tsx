"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { apiKeysApi, type UserApiKey } from "@/lib/api-keys-api";
import { getApiErrorMessage } from "@/lib/auth-api";

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

export default function DashboardApiKeysPanel() {
  const [keys, setKeys] = useState<UserApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [createdWarning, setCreatedWarning] = useState("");
  const [createdPrefix, setCreatedPrefix] = useState("");
  const [copied, setCopied] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<UserApiKey | null>(null);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiKeysApi.list();
      const items = Array.isArray(data.apiKeys) ? data.apiKeys : [];
      setKeys(
        [...items].sort((a, b) => {
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          return bTime - aTime;
        })
      );
    } catch (err) {
      setKeys([]);
      setError(getApiErrorMessage(err, "Could not load API keys."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError("");
    setCopied(false);
    try {
      const data = await apiKeysApi.create(name.trim() || "API key");
      setCreatedRawKey(data.rawKey);
      setCreatedWarning(data.warning || "Store this key now. It will not be shown again.");
      setCreatedPrefix(data.apiKey.keyPrefix);
      setName("");
      await loadKeys();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not create API key."));
    } finally {
      setCreating(false);
    }
  }

  function dismissCreatedKeyModal() {
    setCreatedRawKey(null);
    setCreatedWarning("");
    setCreatedPrefix("");
    setCopied(false);
  }

  async function copyRawKey() {
    if (!createdRawKey) return;
    try {
      await navigator.clipboard.writeText(createdRawKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard. Select the key and copy manually.");
    }
  }

  async function confirmRevoke() {
    if (!revokeTarget || revokingId) return;
    const id = revokeTarget.id;
    setRevokingId(id);
    setError("");
    try {
      await apiKeysApi.revoke(id);
      setRevokeTarget(null);
      await loadKeys();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not revoke API key."));
    } finally {
      setRevokingId(null);
    }
  }

  const activeKeys = keys.filter((key) => !key.revokedAt);
  const revokedKeys = keys.filter((key) => Boolean(key.revokedAt));

  return (
    <section className="rounded-2xl border border-white/10 bg-navy-900/60 p-6 sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">API Keys</h2>
          <p className="mt-1 text-sm text-slate-400">
            Create a key once, copy it, then call the API with{" "}
            <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-slate-200">
              Authorization: Bearer &lt;key&gt;
            </code>
            . Keys start with <span className="font-mono text-slate-300">dv21_</span>.
            You can also connect a key on the sign-in page to use job scrape and resume generation without email login.
          </p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="api-key-name" className="mb-1.5 block text-xs font-medium text-slate-400">
            Key name <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input
            id="api-key-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My app"
            className={fieldClass}
            maxLength={80}
            autoComplete="off"
          />
        </div>
        <Button type="submit" size="sm" disabled={creating} className="shrink-0">
          {creating ? "Creating…" : "Create API key"}
        </Button>
      </form>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <div className="rounded-xl border border-white/10 px-4 py-10 text-center text-sm text-slate-400">
            Loading API keys…
          </div>
        ) : activeKeys.length === 0 && revokedKeys.length === 0 ? (
          <div className="rounded-xl border border-white/10 px-4 py-10 text-center text-sm text-slate-400">
            No API keys yet. Create one to authenticate from your own apps.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Prefix</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Last used</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {activeKeys.map((key) => (
                  <tr key={key.id} className="align-middle">
                    <td className="px-4 py-3 font-medium text-white">{key.name || "API key"}</td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-white/[0.06] px-2 py-1 font-mono text-xs text-slate-300">
                        {key.keyPrefix}…
                      </code>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">{formatDate(key.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">{formatDate(key.lastUsedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setRevokeTarget(key)}
                        disabled={revokingId === key.id}
                        className="!border-red-500/40 !text-red-300 hover:!bg-red-500/10"
                      >
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))}
                {revokedKeys.map((key) => (
                  <tr key={key.id} className="align-middle opacity-60">
                    <td className="px-4 py-3 font-medium text-slate-300">
                      {key.name || "API key"}
                      <span className="ml-2 rounded-full bg-white/[0.06] px-2 py-0.5 text-[12px] uppercase tracking-wide text-slate-400">
                        Revoked
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-white/[0.06] px-2 py-1 font-mono text-xs text-slate-400">
                        {key.keyPrefix}…
                      </code>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(key.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(key.lastUsedAt)}</td>
                    <td className="px-4 py-3 text-right text-xs text-slate-500">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(createdRawKey)}
        onClose={dismissCreatedKeyModal}
        title="API key created"
        className="max-w-xl"
        priority
      >
        <div className="space-y-4 px-6 py-5">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            {createdWarning || "Store this key now. It will not be shown again."}
          </div>
          {createdPrefix ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Prefix: <span className="font-mono text-slate-700 dark:text-slate-300">{createdPrefix}…</span>
            </p>
          ) : null}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Your secret key
            </p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/[0.10] dark:bg-white/[0.03]">
              <code className="block break-all font-mono text-sm text-slate-900 dark:text-white">
                {createdRawKey}
              </code>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={() => void copyRawKey()}>
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={dismissCreatedKeyModal}>
              Done
            </Button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Use it as{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] dark:bg-white/[0.06]">
              Authorization: Bearer {createdRawKey?.slice(0, 12)}…
            </code>
          </p>
        </div>
      </Modal>

      <Modal
        open={Boolean(revokeTarget)}
        onClose={() => {
          if (!revokingId) setRevokeTarget(null);
        }}
        title="Revoke API key?"
        className="max-w-md"
        priority
      >
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Revoke{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              {revokeTarget?.name || "this key"}
            </span>{" "}
            (<code className="font-mono text-xs text-slate-500">
              ({revokeTarget?.keyPrefix}…)
            </code>
            ? Apps using this key will stop working immediately.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRevokeTarget(null)}
              disabled={Boolean(revokingId)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void confirmRevoke()}
              disabled={Boolean(revokingId)}
              className="!bg-red-600 !shadow-red-600/25 hover:!bg-red-500"
            >
              {revokingId ? "Revoking…" : "Revoke key"}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
