"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { getApiErrorMessage } from "@/lib/auth-api";
import {
  integrationsApi,
  isIntegrationKeyMissingError,
  type IntegrationProfile,
} from "@/lib/integrations-api";
import {
  clearDefaultJobCommunityProfileId,
  clearIntegrationKey,
  getDefaultJobCommunityProfileId,
  getIntegrationKey,
  JOB_COMMUNITY_KEY_PREFIX,
  setDefaultJobCommunityProfileId,
  setIntegrationKey,
} from "@/lib/job-community-storage";

const fieldClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40";

function profileLabel(profile: IntegrationProfile): string {
  const name = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
  return name || profile.entity_id;
}

type DashboardJobCommunityPanelProps = {
  userId: string;
};

export default function DashboardJobCommunityPanel({ userId }: DashboardJobCommunityPanelProps) {
  const [keyDraft, setKeyDraft] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [keyMasked, setKeyMasked] = useState("");
  const [profiles, setProfiles] = useState<IntegrationProfile[]>([]);
  const [profileId, setProfileId] = useState("");
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const syncKeyState = useCallback(() => {
    const stored = getIntegrationKey();
    setHasKey(Boolean(stored));
    if (stored) {
      const tail = stored.slice(-4);
      setKeyMasked(`${JOB_COMMUNITY_KEY_PREFIX}…${tail}`);
    } else {
      setKeyMasked("");
    }
  }, []);

  const loadProfiles = useCallback(async () => {
    if (!getIntegrationKey()) {
      setProfiles([]);
      return;
    }
    setLoadingProfiles(true);
    setError("");
    try {
      const items = await integrationsApi.listProfiles();
      setProfiles(items);
      const saved = getDefaultJobCommunityProfileId(userId);
      if (saved && items.some((p) => p.entity_id === saved)) {
        setProfileId(saved);
      } else if (items.length === 1) {
        setProfileId(items[0].entity_id);
      } else if (saved) {
        setProfileId(saved);
      }
    } catch (err) {
      setProfiles([]);
      if (isIntegrationKeyMissingError(err)) {
        clearIntegrationKey();
        syncKeyState();
      }
      setError(getApiErrorMessage(err, "Could not load Job Community profiles."));
    } finally {
      setLoadingProfiles(false);
    }
  }, [syncKeyState, userId]);

  useEffect(() => {
    syncKeyState();
    setProfileId(getDefaultJobCommunityProfileId(userId) || "");
  }, [syncKeyState, userId]);

  useEffect(() => {
    if (hasKey) {
      void loadProfiles();
    } else {
      setProfiles([]);
    }
  }, [hasKey, loadProfiles]);

  async function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    if (savingKey) return;
    setSavingKey(true);
    setError("");
    setMessage("");
    try {
      setIntegrationKey(keyDraft);
      setKeyDraft("");
      syncKeyState();
      setMessage("Integration key saved in this browser.");
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save integration key.");
    } finally {
      setSavingKey(false);
    }
  }

  function handleClearKey() {
    clearIntegrationKey();
    clearDefaultJobCommunityProfileId(userId);
    setKeyDraft("");
    setProfileId("");
    setProfiles([]);
    setMessage("Integration key removed from this browser.");
    setError("");
    syncKeyState();
  }

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (savingProfile || !profileId.trim()) return;
    setSavingProfile(true);
    setError("");
    setMessage("");
    try {
      setDefaultJobCommunityProfileId(userId, profileId.trim());
      setMessage("Default Job Community profile saved for this account.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <section id="job-community" className="rounded-2xl border border-white/10 bg-navy-900/60 p-6 sm:p-8 scroll-mt-24">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Job Community</h2>
          <p className="mt-1 text-sm text-slate-400">
            Paste a{" "}
            <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-slate-200">
              bck_
            </code>{" "}
            integration key from Job Community → My account. It stays in this browser only and is
            sent to Devora as{" "}
            <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-slate-200">
              X-Integration-Key
            </code>
            . After saving, pick the default profile used when creating bid logs.
          </p>
        </div>
      </div>

      <form onSubmit={(e) => void handleSaveKey(e)} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="job-community-key" className="mb-1.5 block text-xs font-medium text-slate-400">
            Integration key
          </label>
          <input
            id="job-community-key"
            type="password"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder={hasKey ? keyMasked || "bck_…" : "bck_…"}
            className={fieldClass}
            autoComplete="off"
            spellCheck={false}
          />
          {hasKey ? (
            <p className="mt-1.5 text-xs text-slate-500">
              Saved key: <span className="font-mono text-slate-400">{keyMasked}</span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={savingKey || !keyDraft.trim()}
            className="shrink-0"
          >
            {savingKey ? "Saving…" : hasKey ? "Update key" : "Save key"}
          </Button>
          {hasKey ? (
            <Button type="button" variant="outline" size="sm" onClick={handleClearKey} className="shrink-0">
              Remove
            </Button>
          ) : null}
        </div>
      </form>

      {hasKey ? (
        <form onSubmit={handleSaveProfile} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="job-community-profile" className="mb-1.5 block text-xs font-medium text-slate-400">
              Default profile
            </label>
            <select
              id="job-community-profile"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              disabled={loadingProfiles || profiles.length === 0}
              className={fieldClass}
            >
              <option value="">
                {loadingProfiles
                  ? "Loading profiles…"
                  : profiles.length === 0
                    ? "No profiles found"
                    : "Select a profile"}
              </option>
              {profiles.map((profile) => (
                <option key={profile.entity_id} value={profile.entity_id}>
                  {profileLabel(profile)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={savingProfile || !profileId.trim() || loadingProfiles}
              className="shrink-0"
            >
              {savingProfile ? "Saving…" : "Save profile"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadProfiles()}
              disabled={loadingProfiles}
              className="shrink-0"
            >
              Refresh
            </Button>
          </div>
        </form>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200" role="status">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </div>
      ) : null}
    </section>
  );
}
