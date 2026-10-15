"use client";

import { useEffect, useState } from "react";
import SuperAdminGatewayCredentialsForm from "@/components/super-admin/SuperAdminGatewayCredentialsForm";
import {
  saCard,
  saDisplay,
  saEyebrow,
  saMono,
} from "@/components/super-admin/resume-dashboard-styles";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/lib/auth-api";
import {
  superAdminGatewayApi,
  type SuperAdminGatewayStatus,
} from "@/lib/super-admin-gateway-api";

/** Change personal Super Admin gateway username/password (inside unlocked console). */
export default function SuperAdminGatewaySettingsCard() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SuperAdminGatewayStatus | null>(null);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const next = await superAdminGatewayApi.getStatus(user.id);
        if (!cancelled) setStatus(next);
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, "Could not load gateway status."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!user?.id) return null;

  return (
    <section className={`${saCard} mt-8 p-6`}>
      <p className={saEyebrow}>Security · Module 04</p>
      <h2 className={`${saDisplay} mt-3 text-xl font-bold tracking-tight text-slate-900`}>
        Gateway credentials
      </h2>
      <p className={`${saMono} mt-2 text-xs leading-relaxed text-slate-500`}>
        Update the username and password that unlock this Super Admin console. Separate from your
        Devora21 account password.
        {status?.username ? (
          <>
            {" "}
            Current username: <span className="font-semibold text-slate-700">{status.username}</span>
          </>
        ) : null}
        {status?.localFallback ? (
          <span className="block mt-1 text-amber-700">
            Stored in this browser until the backend gateway API is live.
          </span>
        ) : null}
      </p>

      {error ? (
        <p className={`${saMono} mt-4 text-xs text-red-600`} role="alert">
          {error}
        </p>
      ) : null}
      {savedFlash ? (
        <p className={`${saMono} mt-4 text-xs text-teal-700`} role="status">
          {savedFlash}
        </p>
      ) : null}

      <div className="mt-5 max-w-md">
        <SuperAdminGatewayCredentialsForm
          userId={user.id}
          mode="change"
          currentUsername={status?.username || ""}
          onSaved={(next) => {
            setStatus(next);
            setSavedFlash("Gateway credentials updated.");
            setError("");
          }}
        />
      </div>
    </section>
  );
}
