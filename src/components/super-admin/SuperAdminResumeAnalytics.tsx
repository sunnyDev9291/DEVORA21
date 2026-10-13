"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import SuperAdminProfileMultiSelect, {
  type ProfileOption,
} from "@/components/super-admin/SuperAdminProfileMultiSelect";
import {
  saBtnGhost,
  saBtnPrimary,
  saCard,
  saChip,
  saChipActive,
  saDisplay,
  saEyebrow,
  saField,
  saLabel,
  saMono,
} from "@/components/super-admin/resume-dashboard-styles";
import { getApiErrorMessage } from "@/lib/auth-api";
import {
  TOTAL_SERIES_COLOR,
  TOTAL_SERIES_KEY,
  colorForProfileIndex,
  computeYAxisMax,
  resolveDateRange,
} from "@/lib/super-admin-chart-scale";
import { superAdminApi } from "@/lib/super-admin-api";
import {
  guessBrowserTimezone,
  percentChange,
  superAdminResumesApi,
  type AdminDatePreset,
  type AdminResumeCompareResponse,
} from "@/lib/super-admin-resumes-api";

type QuickPreset = "today" | "last7" | "last30" | "month" | "all" | "custom";

const QUICK_PRESETS: { id: QuickPreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom" },
];

function KpiCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: number;
  delta?: number | null;
}) {
  return (
    <div className={`${saCard} relative overflow-hidden p-5`}>
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
      ) : null}
    </div>
  );
}

type ChartRow = Record<string, string | number>;

export default function SuperAdminResumeAnalytics() {
  const [profileOptions, setProfileOptions] = useState<ProfileOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [initializedSelection, setInitializedSelection] = useState(false);
  const [preset, setPreset] = useState<QuickPreset>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<AdminResumeCompareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showBars, setShowBars] = useState(true);
  const [showLines, setShowLines] = useState(true);
  const [showTotalBars, setShowTotalBars] = useState(true);
  const [showTotalLines, setShowTotalLines] = useState(true);
  const [hiddenProfileBars, setHiddenProfileBars] = useState<Set<string>>(new Set());
  const [hiddenProfileLines, setHiddenProfileLines] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await superAdminApi.listUsers({ page: 1, limit: 100 });
        if (cancelled) return;
        const opts = list.users.map((u) => ({
          id: u.id,
          label: u.name?.trim() || u.email || u.id,
          email: u.email,
        }));
        setProfileOptions(opts);
        if (!initializedSelection) {
          setSelectedIds(opts.map((o) => o.id));
          setInitializedSelection(true);
        }
      } catch {
        if (!cancelled) setError("Could not load profiles for analytics.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initializedSelection]);

  const load = useCallback(async () => {
    if (!selectedIds.length) {
      setData({
        timezone: guessBrowserTimezone(),
        from: "",
        to: "",
        profiles: [],
        series: [],
        rankings: [],
        grandTotal: 0,
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const range = resolveDateRange(preset, from, to);
      const meta = profileOptions
        .filter((o) => selectedIds.includes(o.id))
        .map((o) => ({
          profileId: o.id,
          profileName: o.label,
          profileEmail: o.email,
        }));

      const compare = await superAdminResumesApi.getCompareAnalytics({
        profileIds: selectedIds,
        profileMeta: meta,
        preset: range.preset as AdminDatePreset,
        from: range.from,
        to: range.to,
        timezone: guessBrowserTimezone(),
      });
      setData(compare);
    } catch (err) {
      setData(null);
      setError(getApiErrorMessage(err, "Could not load resume analytics."));
    } finally {
      setLoading(false);
    }
  }, [selectedIds, preset, from, to, profileOptions]);

  useEffect(() => {
    if (!initializedSelection) return;
    const timer = window.setTimeout(() => {
      void load();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [load, initializedSelection]);

  const colorByProfile = useMemo(() => {
    const map = new Map<string, string>();
    selectedIds.forEach((id, index) => map.set(id, colorForProfileIndex(index)));
    return map;
  }, [selectedIds]);

  const chartRows: ChartRow[] = useMemo(() => {
    if (!data?.series.length) return [];
    return data.series.map((point) => {
      const row: ChartRow = {
        date: point.date,
        [TOTAL_SERIES_KEY]: point.total,
      };
      for (const id of selectedIds) {
        row[id] = point.byProfile[id] ?? 0;
      }
      return row;
    });
  }, [data, selectedIds]);

  const yMax = useMemo(() => {
    let highest = 0;
    for (const row of chartRows) {
      if (showTotalBars || showTotalLines) {
        highest = Math.max(highest, Number(row[TOTAL_SERIES_KEY] ?? 0));
      }
      for (const id of selectedIds) {
        const barVisible = showBars && !hiddenProfileBars.has(id);
        const lineVisible = showLines && !hiddenProfileLines.has(id);
        if (barVisible || lineVisible) {
          highest = Math.max(highest, Number(row[id] ?? 0));
        }
      }
    }
    return computeYAxisMax(highest);
  }, [
    chartRows,
    selectedIds,
    showBars,
    showLines,
    showTotalBars,
    showTotalLines,
    hiddenProfileBars,
    hiddenProfileLines,
  ]);

  const rangeDelta = percentChange(data?.totals?.range ?? data?.grandTotal ?? 0, data?.totals?.previousRange);

  const labelFor = (id: string) =>
    profileOptions.find((o) => o.id === id)?.label ||
    data?.profiles.find((p) => p.profileId === id)?.profileName ||
    id;

  function toggleSet(setter: Dispatch<SetStateAction<Set<string>>>, id: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const xInterval = chartRows.length > 45 ? Math.ceil(chartRows.length / 14) : chartRows.length > 20 ? 1 : 0;

  return (
    <div className="space-y-6">
      <div className={`${saCard} space-y-5 p-5 sm:p-6`}>
        <div className="flex flex-wrap gap-2">
          {QUICK_PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPreset(item.id)}
              className={preset === item.id ? saChipActive : saChip}
            >
              {item.label}
            </button>
          ))}
        </div>

        {preset === "custom" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="sa-adv-from" className={saLabel}>
                From
              </label>
              <input
                id="sa-adv-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className={saField}
              />
            </div>
            <div>
              <label htmlFor="sa-adv-to" className={saLabel}>
                To
              </label>
              <input
                id="sa-adv-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className={saField}
              />
            </div>
          </div>
        ) : null}

        <SuperAdminProfileMultiSelect
          options={profileOptions}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          disabled={loading && !profileOptions.length}
        />

        <div className="flex flex-wrap gap-2">
          <button type="button" className={saBtnPrimary} onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh chart"}
          </button>
          <button
            type="button"
            className={showBars ? saChipActive : saChip}
            onClick={() => setShowBars((v) => !v)}
          >
            {showBars ? "Hide bars" : "Show bars"}
          </button>
          <button
            type="button"
            className={showLines ? saChipActive : saChip}
            onClick={() => setShowLines((v) => !v)}
          >
            {showLines ? "Hide lines" : "Show lines"}
          </button>
          <button
            type="button"
            className={showTotalBars ? saChipActive : saChip}
            onClick={() => setShowTotalBars((v) => !v)}
          >
            {showTotalBars ? "Hide total bars" : "Show total bars"}
          </button>
          <button
            type="button"
            className={showTotalLines ? saChipActive : saChip}
            onClick={() => setShowTotalLines((v) => !v)}
          >
            {showTotalLines ? "Hide total line" : "Show total line"}
          </button>
        </div>
      </div>

      {error ? (
        <div
          className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-xs text-red-200"
          role="alert"
        >
          <p className={saMono}>{error}</p>
          <p className={`${saMono} mt-2 text-[#8b9aab]`}>
            Prefer <code className="text-teal-200/80">GET /admin/resumes/analytics/compare</code>. FE
            can fall back to per-profile analytics when that route is missing.
          </p>
        </div>
      ) : null}

      {data?.totals ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Today" value={data.totals.today} />
          <KpiCard label="This week" value={data.totals.week} />
          <KpiCard label="This month" value={data.totals.month} />
          <KpiCard label="All time" value={data.totals.allTime} />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <KpiCard
          label="Selected range total"
          value={data?.grandTotal ?? 0}
          delta={rangeDelta}
        />
        <div className={`${saCard} p-5`}>
          <p className={saEyebrow}>Scope</p>
          <p className={`${saMono} mt-3 text-sm text-[#f4f7fb]`}>
            {selectedIds.length} profile{selectedIds.length === 1 ? "" : "s"}
          </p>
          <p className={`${saMono} mt-2 text-[11px] text-[#6b7c8f]`}>
            TZ {data?.timezone || guessBrowserTimezone()}
            {data?.from && data?.to ? ` · ${data.from} → ${data.to}` : ""}
          </p>
        </div>
      </div>

      <div className={`${saCard} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className={saEyebrow}>Daily activity</p>
            <h3 className={`${saDisplay} mt-1 text-lg font-bold text-[#f4f7fb]`}>
              Profiles · bars + smooth totals
            </h3>
          </div>
          <p className={`${saMono} text-[11px] text-[#6b7c8f]`}>
            Y max {yMax} · headroom ~30%
          </p>
        </div>

        <div className="mt-4 h-[26rem] w-full overflow-x-auto">
          {loading && !chartRows.length ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-400/40 border-t-teal-300" />
            </div>
          ) : chartRows.length === 0 ? (
            <div className={`flex h-full items-center justify-center ${saMono} text-xs text-[#6b7c8f]`}>
              {selectedIds.length ? "No resume activity in this range." : "Select at least one profile."}
            </div>
          ) : (
            <div className="h-full min-w-[640px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartRows} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="#1e2a36" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#6b7c8f", fontSize: 11 }}
                    minTickGap={18}
                    interval={xInterval}
                  />
                  <YAxis
                    domain={[0, yMax]}
                    allowDecimals={false}
                    tick={{ fill: "#6b7c8f", fontSize: 11 }}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(16, 24, 32, 0.96)",
                      border: "1px solid rgba(45, 212, 191, 0.22)",
                      borderRadius: 12,
                      fontSize: 12,
                      color: "#d7e0ea",
                    }}
                    formatter={(value: number, name: string) => {
                      const label =
                        name === TOTAL_SERIES_KEY ? "Total SUM" : labelFor(name);
                      return [value, label];
                    }}
                    labelFormatter={(label) => `Date · ${label}`}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: "#8b9aab" }}
                    formatter={(value) =>
                      value === TOTAL_SERIES_KEY ? "Total SUM" : labelFor(String(value))
                    }
                  />

                  {showTotalBars ? (
                    <Bar
                      dataKey={TOTAL_SERIES_KEY}
                      name={TOTAL_SERIES_KEY}
                      fill={TOTAL_SERIES_COLOR}
                      fillOpacity={0.22}
                      stroke={TOTAL_SERIES_COLOR}
                      strokeOpacity={0.55}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                      isAnimationActive
                    />
                  ) : null}

                  {selectedIds.map((id) =>
                    showBars && !hiddenProfileBars.has(id) ? (
                      <Bar
                        key={`bar-${id}`}
                        dataKey={id}
                        name={id}
                        fill={colorByProfile.get(id)}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={22}
                        isAnimationActive
                      />
                    ) : null
                  )}

                  {showTotalLines ? (
                    <Line
                      type="monotone"
                      dataKey={TOTAL_SERIES_KEY}
                      name={TOTAL_SERIES_KEY}
                      stroke={TOTAL_SERIES_COLOR}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                      isAnimationActive
                    />
                  ) : null}

                  {selectedIds.map((id) =>
                    showLines && !hiddenProfileLines.has(id) ? (
                      <Line
                        key={`line-${id}`}
                        type="monotone"
                        dataKey={id}
                        name={id}
                        stroke={colorByProfile.get(id)}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 3 }}
                        isAnimationActive
                      />
                    ) : null
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {selectedIds.length ? (
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {selectedIds.map((id) => (
              <div
                key={`vis-${id}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-[#1e2a36] bg-[#0d141c]/60 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: colorByProfile.get(id) }}
                  />
                  <span className={`${saMono} truncate text-[11px] text-[#c5d0dc]`}>
                    {labelFor(id)}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className={`${saBtnGhost} h-7 px-2 text-[9px] ${
                      !hiddenProfileBars.has(id) ? "border-teal-400/40 text-teal-100" : ""
                    }`}
                    onClick={() => toggleSet(setHiddenProfileBars, id)}
                  >
                    Bar
                  </button>
                  <button
                    type="button"
                    className={`${saBtnGhost} h-7 px-2 text-[9px] ${
                      !hiddenProfileLines.has(id) ? "border-teal-400/40 text-teal-100" : ""
                    }`}
                    onClick={() => toggleSet(setHiddenProfileLines, id)}
                  >
                    Line
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className={`${saCard} p-5 sm:p-6`}>
        <p className={saEyebrow}>Ranking</p>
        <h3 className={`${saDisplay} mt-1 text-lg font-bold text-[#f4f7fb]`}>
          Selected profiles · range totals
        </h3>
        <p className={`${saMono} mt-2 text-xs text-[#6b7c8f]`}>
          Grand total { (data?.grandTotal ?? 0).toLocaleString() } · visibility toggles do not change
          rankings
        </p>
        <div className="mt-4 overflow-auto">
          {!data?.rankings.length ? (
            <p className={`${saMono} text-xs text-[#6b7c8f]`}>No ranking data yet.</p>
          ) : (
            <table className={`min-w-full text-left ${saMono} text-xs text-[#c5d0dc]`}>
              <thead className="border-b border-teal-400/10 text-[10px] uppercase tracking-[0.14em] text-[#6b7c8f]">
                <tr>
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">Profile</th>
                  <th className="px-2 py-2 font-medium text-right">Resumes</th>
                  <th className="px-2 py-2 font-medium text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {data.rankings.map((row, index) => (
                  <tr key={row.profileId} className="border-t border-[#1e2a36]/80">
                    <td className="px-2 py-2.5 text-[#6b7c8f]">{index + 1}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: colorByProfile.get(row.profileId) || "#64748b" }}
                        />
                        <div>
                          <p className="text-[#f4f7fb]">
                            {row.profileName || row.profileEmail || row.profileId}
                          </p>
                          {row.profileEmail && row.profileName ? (
                            <p className="text-[10px] text-[#6b7c8f]">{row.profileEmail}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{row.count.toLocaleString()}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-[#8b9aab]">
                      {row.percent.toFixed(1)}%
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-teal-400/20 bg-teal-400/[0.04]">
                  <td className="px-2 py-3" colSpan={2}>
                    <span className="font-semibold text-[#f4f7fb]">Grand Total SUM</span>
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums font-semibold text-[#f4f7fb]">
                    {(data.grandTotal ?? 0).toLocaleString()}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums text-teal-200/80">100%</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
