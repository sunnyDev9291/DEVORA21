"use client";

import { FormEvent, useState } from "react";
import { ApiError, getApiErrorMessage } from "@/lib/auth-api";
import {
  superAdminGatewayApi,
  validateGatewayPassword,
  validateGatewayUsername,
  type SuperAdminGatewayStatus,
} from "@/lib/super-admin-gateway-api";
import {
  saAlert,
  saBtnPrimary,
  saField,
  saLabel,
  saMono,
} from "@/components/super-admin/resume-dashboard-styles";

type Mode = "setup" | "change";

type SuperAdminGatewayCredentialsFormProps = {
  userId: string;
  mode: Mode;
  /** Current username when changing. */
  currentUsername?: string;
  onSaved: (status: SuperAdminGatewayStatus) => void;
  submitLabel?: string;
};

export default function SuperAdminGatewayCredentialsForm({
  userId,
  mode,
  currentUsername = "",
  onSaved,
  submitLabel,
}: SuperAdminGatewayCredentialsFormProps) {
  const [username, setUsername] = useState(currentUsername);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");

    const userErr = validateGatewayUsername(username);
    if (userErr) {
      setError(userErr);
      return;
    }
    const passErr = validateGatewayPassword(password);
    if (passErr) {
      setError(passErr);
      return;
    }
    if (password !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }
    if (mode === "change" && !currentPassword) {
      setError("Enter your current gateway password.");
      return;
    }

    setSaving(true);
    try {
      const status = await superAdminGatewayApi.setCredentials(
        userId,
        {
          username,
          password,
          currentPassword: mode === "change" ? currentPassword : undefined,
        },
        { alreadyConfigured: mode === "change" }
      );
      setPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
      if (status.localFallback) {
        setNotice(
          "Saved on this browser for now. Deploy the gateway-credentials API to store them server-side."
        );
      }
      onSaved(status);
    } catch (err) {
      setError(getApiErrorMessage(err, (err as ApiError)?.message || "Could not save credentials."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      {mode === "change" ? (
        <div>
          <label htmlFor="sa-gw-current" className={saLabel}>
            Current password
          </label>
          <input
            id="sa-gw-current"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={saField}
          />
        </div>
      ) : null}

      <div>
        <label htmlFor="sa-gw-username" className={saLabel}>
          Gateway username
        </label>
        <input
          id="sa-gw-username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={saField}
          spellCheck={false}
        />
      </div>

      <div>
        <label htmlFor="sa-gw-password" className={saLabel}>
          {mode === "change" ? "New password" : "Password"}
        </label>
        <input
          id="sa-gw-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={saField}
        />
      </div>

      <div>
        <label htmlFor="sa-gw-confirm" className={saLabel}>
          Confirm password
        </label>
        <input
          id="sa-gw-confirm"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={saField}
        />
      </div>

      {error ? (
        <p className={`${saAlert} ${saMono} px-3 py-2.5 text-xs`} role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className={`${saMono} rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800`}>
          {notice}
        </p>
      ) : null}

      <button type="submit" disabled={saving} className={`${saBtnPrimary} w-full disabled:opacity-60`}>
        {saving
          ? "Saving…"
          : submitLabel || (mode === "setup" ? "Create gateway credentials" : "Update credentials")}
      </button>
    </form>
  );
}
