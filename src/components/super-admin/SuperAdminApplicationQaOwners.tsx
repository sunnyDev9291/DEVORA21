"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  saAlert,
  saCardInteractive,
  saDisplay,
  saEyebrow,
  saMono,
} from "@/components/super-admin/resume-dashboard-styles";
import { AUTH_LINKS } from "@/lib/constants";
import { getApiErrorMessage } from "@/lib/auth-api";
import { formatEstDateTime } from "@/lib/format-est-datetime";
import {
  displayApplicationQaOwnerName,
  superAdminApplicationQaApi,
  type ApplicationQaOwner,
} from "@/lib/super-admin-application-qa-api";

export default function SuperAdminApplicationQaOwners() {
  const [owners, setOwners] = useState<ApplicationQaOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const list = await superAdminApplicationQaApi.listOwners();
        if (!cancelled) setOwners(list);
      } catch (err) {
        if (!cancelled) {
          setOwners([]);
          setError(getApiErrorMessage(err, "Could not load extension owners."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <p className={`${saMono} mt-8 text-xs text-slate-500`}>Loading owners…</p>
    );
  }

  if (error) {
    return (
      <p className={`${saAlert} ${saMono} mt-8 px-4 py-3 text-xs`} role="alert">
        {error}
      </p>
    );
  }

  if (!owners.length) {
    return (
      <div className={`${saCardInteractive} mt-8 p-6`}>
        <p className={saEyebrow}>Empty</p>
        <p className={`${saDisplay} mt-3 text-lg font-bold text-slate-900`}>No recordings yet</p>
        <p className={`${saMono} mt-2 text-xs text-slate-500`}>
          When Chrome extension owners sync Application Q&amp;A sessions, they will appear here.
        </p>
        <Link
          href={`${AUTH_LINKS.superAdmin}/application-qa/sessions`}
          className={`${saMono} mt-4 inline-flex text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-700`}
        >
          Browse all sessions →
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className={`${saMono} text-[11px] text-slate-400`}>
          {owners.length} owner{owners.length === 1 ? "" : "s"}
        </p>
        <Link
          href={`${AUTH_LINKS.superAdmin}/application-qa/sessions`}
          className={`${saMono} text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-700 hover:underline`}
        >
          All sessions →
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {owners.map((owner, index) => {
          const href = `${AUTH_LINKS.superAdmin}/application-qa/sessions?userId=${encodeURIComponent(owner.userId)}`;
          const synced = owner.lastSyncedAt
            ? formatEstDateTime(owner.lastSyncedAt) || owner.lastSyncedAt
            : "Never synced";
          return (
            <Link
              key={owner.userId}
              href={href}
              className={`${saCardInteractive} group block p-5 ${
                index < 2 ? "sa-animate-in-delay-1" : "sa-animate-in-delay-2"
              }`}
            >
              <p className={saEyebrow}>Extension owner</p>
              <p
                className={`${saDisplay} mt-3 text-lg font-bold tracking-tight text-slate-900 transition-colors group-hover:text-teal-800`}
              >
                {displayApplicationQaOwnerName(owner)}
              </p>
              {owner.email ? (
                <p className={`${saMono} mt-1 truncate text-xs text-slate-500`}>{owner.email}</p>
              ) : null}
              <div className={`${saMono} mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500`}>
                <span>
                  <span className="font-semibold text-slate-700">{owner.sessionCount}</span>{" "}
                  session{owner.sessionCount === 1 ? "" : "s"}
                </span>
                <span>Last sync · {synced}</span>
              </div>
              <span
                className={`${saMono} mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-700 transition-all group-hover:gap-3`}
              >
                View sessions <span aria-hidden>→</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
