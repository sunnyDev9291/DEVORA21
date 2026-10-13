"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import SuperAdminResumeFilters, {
  DEFAULT_RESUME_FILTERS,
  filtersToApi,
  type ResumeFilterState,
} from "@/components/super-admin/SuperAdminResumeFilters";
import {
  saCard,
  saDisplay,
  saEyebrow,
  saMono,
} from "@/components/super-admin/resume-dashboard-styles";
import { getApiErrorMessage } from "@/lib/auth-api";
import { superAdminApi } from "@/lib/super-admin-api";
import {
  percentChange,
  superAdminResumesApi,
  type AdminResumeAnalyticsResponse,
} from "@/lib/super-admin-resumes-api";

function KpiCard({
  label,
  value,
  delta,
  delayClass = "",
}: {
  label: string;
  value: number;
  delta?: number | null;
  delayClass?: string;
}) {
  return (
    <div className={`${saCard} ${delayClass} relative overflow-hidden p-5`}>
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-teal-400/[0.07] blur-2xl"
        aria-hidden
      />
      <p className={saEyebrow}>{label}</p>
      <p className={`${saDisplay} mt-3 text-3xl font-extrabold tabular-nums tracking-tight text-[#f4f7fb]`}>
        {value.toLocaleString()}
      </p>
      {delta !== null && delta !== undefined ? (
        <p
          className={`${saMono} mt-2 text-[11px] ${
            delta > 0 ? "text-emerald-300" : delta < 0 ? "text-rose-300" : "text-[#6b7c8f]"
          }`}
        >
          {delta > 0 ? "+" : ""}
          {delta}% vs prior period
        </p>
      ) : (
        <p className={`${saMono} mt-2 text-[11px] text-[#6b7c8f]`}>vs prior period — n/a</p>
      )}
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "rgba(16, 24, 32, 0.95)",
  border: "1px solid rgba(45, 212, 191, 0.2)",
  borderRadius: 12,
  fontSize: 12,
  color: "#d7e0ea",
  backdropFilter: "blur(8px)",
};

export default function SuperAdminResumeAnalytics() {
  const [filters, setFilters] = useState<ResumeFilterState>(DEFAULT_RESUME_FILTERS);
  const [applied, setApplied] = useState<ResumeFilterState>(DEFAULT_RESUME_FILTERS);
  const [data, setData] = useState<AdminResumeAnalyticsResponse | null>(null);
  const [profiles, setProfiles] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await superAdminApi.listUsers({ page: 1, limit: 100 });
        if (cancelled) return;
        setProfiles(
          list.users.map((u) => ({
            id: u.id,
            label: u.name?.trim() || u.email || u.id,
          }))
        );
      } catch {
        // Profiles filter stays free-text if list fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async (next: ResumeFilterState) => {
    setLoading(true);
    setError("");
    try {
      const analytics = await superAdminResumesApi.getAnalytics(filtersToApi(next));
      setData(analytics);
      setApplied(next);
    } catch (err) {
      setData(null);
      setError(getApiErrorMessage(err, "Could not load resume analytics."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(DEFAULT_RESUME_FILTERS);
  }, [load]);

  const rangeDelta = useMemo(
    () => percentChange(data?.totals.range ?? 0, data?.totals.previousRange),
    [data]
  );

  const topProfiles = data?.topProfiles ?? [];

  return (
    <div className="space-y-6">
      <SuperAdminResumeFilters
        value={filters}
        onChange={setFilters}
        onApply={() => void load(filters)}
        profiles={profiles}
        showKeywordFields={false}
        applying={loading}
      />

      {error ? (
        <div
          className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300"
          role="alert"
        >
          <p className={saMono}>{error}</p>
          <p className={`${saMono} mt-2 text-[#8b9aab]`}>
            Backend must expose <code className="text-teal-200/80">GET /admin/resumes/analytics</code>{" "}
            for super-admin sessions.
          </p>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-400/40 border-t-teal-300" />
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Today" value={data.totals.today} delayClass="sa-animate-in" />
            <KpiCard label="This week" value={data.totals.week} delayClass="sa-animate-in-delay-1" />
            <KpiCard label="This month" value={data.totals.month} delayClass="sa-animate-in-delay-2" />
            <KpiCard label="All time" value={data.totals.allTime} delayClass="sa-animate-in-delay-3" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <KpiCard label="Selected range" value={data.totals.range} delta={rangeDelta} />
            <div className={`${saCard} p-5`}>
              <p className={saEyebrow}>Scope</p>
              <p className={`${saMono} mt-3 text-sm text-[#f4f7fb]`}>
                {applied.profileId ? "Single profile" : "Platform (all profiles)"}
              </p>
              <p className={`${saMono} mt-2 text-[11px] text-[#6b7c8f]`}>
                TZ {data.timezone || "UTC"}
                {data.from && data.to ? ` · ${data.from} → ${data.to}` : ""}
              </p>
            </div>
          </div>

          <div className={`${saCard} p-5 sm:p-6`}>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className={saEyebrow}>Trend</p>
                <h3 className={`${saDisplay} mt-1 text-lg font-bold text-[#f4f7fb]`}>
                  Resumes over time
                </h3>
              </div>
              {loading ? (
                <span className={`${saMono} text-[11px] text-[#6b7c8f]`}>Refreshing…</span>
              ) : null}
            </div>
            <div className="mt-4 h-72 w-full">
              {data.series.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="saResumeFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1e2a36" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fill: "#6b7c8f", fontSize: 11 }} minTickGap={24} />
                    <YAxis allowDecimals={false} tick={{ fill: "#6b7c8f", fontSize: 11 }} width={36} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12, color: "#8b9aab" }} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name="Current"
                      stroke="#2dd4bf"
                      fill="url(#saResumeFill)"
                      strokeWidth={2}
                    />
                    {data.series.some((p) => p.previousCount !== undefined) ? (
                      <Area
                        type="monotone"
                        dataKey="previousCount"
                        name="Prior period"
                        stroke="#64748b"
                        fill="transparent"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                      />
                    ) : null}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className={`flex h-full items-center justify-center ${saMono} text-xs text-[#6b7c8f]`}>
                  No series data for this range.
                </div>
              )}
            </div>
          </div>

          <div className={`${saCard} p-5 sm:p-6`}>
            <p className={saEyebrow}>Leaderboard</p>
            <h3 className={`${saDisplay} mt-1 text-lg font-bold text-[#f4f7fb]`}>
              Most active profiles
            </h3>
            <div className="mt-4 max-h-72 overflow-auto">
              {topProfiles.length === 0 ? (
                <p className={`${saMono} text-xs text-[#6b7c8f]`}>No profile stats yet.</p>
              ) : (
                <table className={`min-w-full text-left ${saMono} text-xs text-[#c5d0dc]`}>
                  <thead className="sticky top-0 bg-[#101820] text-[10px] uppercase tracking-[0.14em] text-[#6b7c8f]">
                    <tr>
                      <th className="px-2 py-2 font-medium">Profile</th>
                      <th className="px-2 py-2 font-medium text-right">Range</th>
                      <th className="px-2 py-2 font-medium text-right">All</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProfiles.map((p) => (
                      <tr key={p.profileId} className="border-t border-[#1e2a36]">
                        <td className="px-2 py-2">
                          <p className="text-[#f4f7fb]">
                            {p.profileName || p.profileEmail || p.profileId}
                          </p>
                          {p.profileEmail && p.profileName ? (
                            <p className="text-[10px] text-[#6b7c8f]">{p.profileEmail}</p>
                          ) : null}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{p.count}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-[#8b9aab]">
                          {p.allTime ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
