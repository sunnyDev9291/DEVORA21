"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import SuperAdminDonutKpi, {
  type DonutSegment,
} from "@/components/super-admin/SuperAdminDonutKpi";
import SuperAdminProfileMultiSelect, {
  type ProfileOption,
} from "@/components/super-admin/SuperAdminProfileMultiSelect";
import {
  saBtnGhost,
  saBtnPrimary,
  saCard,
  saChip,
  saChipActive,
  saField,
  saLabel,
  saMono,
} from "@/components/super-admin/resume-dashboard-styles";
import { getApiErrorMessage } from "@/lib/auth-api";
import {
  TOTAL_SERIES_COLOR,
  TOTAL_SERIES_KEY,
  colorForProfileId,
  computeYAxisMax,
  resolveDateRange,
  type AnalyticsDatePreset,
} from "@/lib/super-admin-chart-scale";
import { superAdminApi } from "@/lib/super-admin-api";
import {
  guessBrowserTimezone,
  superAdminResumesApi,
  type AdminResumeCompareResponse,
  type AdminResumeOverviewBucket,
  type AdminResumeOverviewResponse,
} from "@/lib/super-admin-resumes-api";

type QuickPreset = AnalyticsDatePreset;

const QUICK_PRESETS: { id: QuickPreset; label: string }[] = [
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "month", label: "This month" },
  { id: "last90", label: "Last 90 days" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom" },
];

type ChartRow = Record<string, string | number>;

function profileLabel(opt: ProfileOption | undefined, id: string): string {
  return opt?.label || id;
}

function bucketToSegments(
  bucket: AdminResumeOverviewBucket,
  selectedIds: string[],
  orderedIds: string[],
  optionsById: Map<string, ProfileOption>
): DonutSegment[] {
  return selectedIds.map((id) => ({
    id,
    name: profileLabel(optionsById.get(id), id),
    value: bucket.byProfile[id] ?? 0,
    color: colorForProfileId(id, orderedIds),
  }));
}

function LineTooltip({
  active,
  label,
  payload,
  optionsById,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ dataKey?: string | number; value?: number; color?: string; name?: string }>;
  optionsById: Map<string, ProfileOption>;
}) {
  if (!active || !payload?.length) return null;
  const dateLabel = label
    ? new Date(`${label}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const rows = [...payload].sort((a, b) => {
    const aSum = String(a.dataKey) === TOTAL_SERIES_KEY ? 1 : 0;
    const bSum = String(b.dataKey) === TOTAL_SERIES_KEY ? 1 : 0;
    if (aSum !== bSum) return bSum - aSum;
    return (b.value ?? 0) - (a.value ?? 0);
  });

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.98)",
        border: "1px solid rgba(15,23,42,0.08)",
        borderRadius: 14,
        padding: "12px 14px",
        boxShadow: "0 12px 32px rgba(15,23,42,0.12)",
        minWidth: 200,
      }}
    >
      <div style={{ fontSize: "0.78rem", fontWeight: 650, color: "#0f172a", marginBottom: 8 }}>
        {dateLabel}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((row) => {
          const key = String(row.dataKey ?? "");
          const isSum = key === TOTAL_SERIES_KEY;
          const name = isSum
            ? "SUM"
            : profileLabel(optionsById.get(key), key);
          return (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                fontSize: "0.78rem",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569" }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 99,
                    background: row.color || TOTAL_SERIES_COLOR,
                  }}
                />
                <span style={{ fontWeight: isSum ? 650 : 500 }}>{name}</span>
              </span>
              <span
                className={saMono}
                style={{ color: "#0f172a", fontWeight: isSum ? 650 : 500 }}
              >
                {(row.value ?? 0).toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SuperAdminResumeAnalytics() {
  const [profileOptions, setProfileOptions] = useState<ProfileOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [initializedSelection, setInitializedSelection] = useState(false);
  const [preset, setPreset] = useState<QuickPreset>("last30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [overview, setOverview] = useState<AdminResumeOverviewResponse | null>(null);
  const [todayAll, setTodayAll] = useState<AdminResumeOverviewBucket | null>(null);
  const [compare, setCompare] = useState<AdminResumeCompareResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingTodayAll, setLoadingTodayAll] = useState(false);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  const optionsById = useMemo(() => {
    const map = new Map<string, ProfileOption>();
    for (const o of profileOptions) map.set(o.id, o);
    return map;
  }, [profileOptions]);

  const orderedIds = useMemo(() => profileOptions.map((o) => o.id), [profileOptions]);

  const profileMeta = useMemo(
    () =>
      selectedIds.map((id) => {
        const opt = optionsById.get(id);
        return {
          profileId: id,
          profileName: opt?.label,
          profileEmail: opt?.email,
        };
      }),
    [selectedIds, optionsById]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const opts: ProfileOption[] = [];
        let page = 1;
        let total = Infinity;
        while (opts.length < total) {
          const res = await superAdminApi.listUsers({ limit: 100, page });
          if (cancelled) return;
          total = res.total;
          for (const u of res.users) {
            opts.push({
              id: u.id,
              label: u.name?.trim() || u.email || u.id,
              email: u.email,
            });
          }
          if (!res.users.length) break;
          page += 1;
          if (page > 50) break;
        }
        if (cancelled) return;
        setProfileOptions(opts);
        if (!initializedSelection) {
          setSelectedIds(opts.map((o) => o.id));
          setInitializedSelection(true);
        }
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, "Could not load profiles."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initializedSelection]);

  const loadOverview = useCallback(async () => {
    if (!selectedIds.length) {
      setOverview(null);
      return;
    }
    setLoadingOverview(true);
    try {
      const data = await superAdminResumesApi.getOverviewAnalytics({
        profileIds: selectedIds,
        profileMeta,
        timezone: guessBrowserTimezone(),
      });
      setOverview(data);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load overview KPIs."));
    } finally {
      setLoadingOverview(false);
    }
  }, [selectedIds, profileMeta]);

  /** Always all profiles — left rail “Today’s activity”, independent of multi-select. */
  const loadTodayAll = useCallback(async () => {
    if (!profileOptions.length) {
      setTodayAll(null);
      return;
    }
    setLoadingTodayAll(true);
    try {
      const ids = profileOptions.map((o) => o.id);
      const data = await superAdminResumesApi.getOverviewAnalytics({
        profileIds: ids,
        profileMeta: profileOptions.map((o) => ({
          profileId: o.id,
          profileName: o.label,
          profileEmail: o.email,
        })),
        timezone: guessBrowserTimezone(),
      });
      setTodayAll(data.today);
    } catch {
      setTodayAll(null);
    } finally {
      setLoadingTodayAll(false);
    }
  }, [profileOptions]);

  const loadCompare = useCallback(async () => {
    if (!selectedIds.length) {
      setCompare(null);
      return;
    }
    const range = resolveDateRange(preset, from, to);
    if (preset === "custom" && (!from || !to)) {
      setCompare(null);
      return;
    }
    setLoadingCompare(true);
    try {
      const data = await superAdminResumesApi.getCompareAnalytics({
        profileIds: selectedIds,
        profileMeta,
        timezone: guessBrowserTimezone(),
        preset: range.preset as
          | "today"
          | "week"
          | "last7"
          | "last30"
          | "last90"
          | "month"
          | "all"
          | "custom",
        from: range.from,
        to: range.to,
      });
      setCompare(data);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load period analytics."));
    } finally {
      setLoadingCompare(false);
    }
  }, [selectedIds, profileMeta, preset, from, to]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    void loadTodayAll();
  }, [loadTodayAll]);

  useEffect(() => {
    void loadCompare();
  }, [loadCompare]);

  const todayActivityRows = useMemo(() => {
    const bucket = todayAll ?? { total: 0, byProfile: {} };
    return profileOptions
      .map((opt) => ({
        id: opt.id,
        name: opt.label,
        email: opt.email,
        count: bucket.byProfile[opt.id] ?? 0,
        color: colorForProfileId(opt.id, orderedIds),
        selected: selectedIds.includes(opt.id),
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
  }, [todayAll, profileOptions, orderedIds, selectedIds]);

  const todayActivityTotal = useMemo(
    () => todayActivityRows.reduce((sum, row) => sum + row.count, 0),
    [todayActivityRows]
  );

  const chartRows: ChartRow[] = useMemo(() => {
    if (!compare?.series?.length) return [];
    return compare.series.map((point) => {
      const row: ChartRow = {
        date: point.date,
        [TOTAL_SERIES_KEY]: point.total,
      };
      for (const id of selectedIds) {
        row[id] = point.byProfile[id] ?? 0;
      }
      return row;
    });
  }, [compare, selectedIds]);

  const yMax = useMemo(() => {
    let highest = 0;
    for (const row of chartRows) {
      if (!hiddenKeys.has(TOTAL_SERIES_KEY)) {
        highest = Math.max(highest, Number(row[TOTAL_SERIES_KEY]) || 0);
      }
      for (const id of selectedIds) {
        if (hiddenKeys.has(id)) continue;
        highest = Math.max(highest, Number(row[id]) || 0);
      }
    }
    return computeYAxisMax(highest);
  }, [chartRows, hiddenKeys, selectedIds]);

  const periodSegments = useMemo(() => {
    if (!compare) return [] as DonutSegment[];
    return selectedIds.map((id) => {
      const rank = compare.rankings.find((r) => r.profileId === id);
      return {
        id,
        name: profileLabel(optionsById.get(id), id),
        value: rank?.count ?? 0,
        color: colorForProfileId(id, orderedIds),
      };
    });
  }, [compare, selectedIds, optionsById, orderedIds]);

  const periodRankings = useMemo(() => {
    return [...periodSegments].sort((a, b) => b.value - a.value);
  }, [periodSegments]);

  const periodTotal = compare?.grandTotal ?? 0;

  const overviewCards = useMemo(() => {
    const empty = { total: 0, byProfile: {} as Record<string, number> };
    const o = overview;
    return [
      { key: "today", title: "Today", bucket: o?.today ?? empty },
      { key: "week", title: "This Week", bucket: o?.week ?? empty },
      { key: "month", title: "This Month", bucket: o?.month ?? empty },
      { key: "allTime", title: "All Time", bucket: o?.allTime ?? empty },
    ] as const;
  }, [overview]);

  function toggleLine(key: string) {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function showAllLines() {
    setHiddenKeys(new Set());
  }

  function hideAllLines() {
    setHiddenKeys(new Set([TOTAL_SERIES_KEY, ...selectedIds]));
  }

  const rangeLabel =
    compare?.from && compare?.to
      ? `${compare.from} → ${compare.to}`
      : preset === "custom" && from && to
        ? `${from} → ${to}`
        : QUICK_PRESETS.find((p) => p.id === preset)?.label ?? "Selected period";

  const loading = loadingOverview || loadingCompare;

  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      {/* Left rail — today's activity for every profile */}
      <aside className={`${saCard} flex w-full shrink-0 flex-col overflow-hidden xl:sticky xl:top-4 xl:w-[280px]`}>
        <div className="border-b border-slate-100 px-4 py-4">
          <p className={`${saLabel} mb-0`}>Today’s activity</p>
          <p className="mt-1 text-sm font-semibold tracking-tight text-slate-900">
            {todayActivityTotal.toLocaleString()}{" "}
            <span className="font-normal text-slate-500">resumes</span>
          </p>
          <p className={`${saMono} mt-1 text-[11px] text-slate-400`}>
            All profiles · calendar today
            {loadingTodayAll ? " · updating…" : ""}
          </p>
        </div>
        <ul className="max-h-[70vh] min-h-0 flex-1 overflow-y-auto py-1">
          {!profileOptions.length ? (
            <li className={`${saMono} px-4 py-8 text-center text-xs text-slate-400`}>
              Loading profiles…
            </li>
          ) : todayActivityRows.length === 0 ? (
            <li className={`${saMono} px-4 py-8 text-center text-xs text-slate-400`}>
              No profiles.
            </li>
          ) : (
            todayActivityRows.map((row) => (
              <li
                key={row.id}
                className={`flex items-start gap-2.5 border-b border-slate-50 px-4 py-3 last:border-b-0 ${
                  row.selected ? "bg-white" : "bg-slate-50/60 opacity-70"
                }`}
              >
                <span
                  className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: row.color }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{row.name}</p>
                  {row.email ? (
                    <p className={`${saMono} truncate text-[10px] text-slate-400`}>{row.email}</p>
                  ) : null}
                </div>
                <span
                  className={`${saMono} shrink-0 text-sm font-semibold tabular-nums ${
                    row.count > 0 ? "text-slate-900" : "text-slate-300"
                  }`}
                >
                  {row.count.toLocaleString()}
                </span>
              </li>
            ))
          )}
        </ul>
      </aside>

      <div className="min-w-0 flex-1 space-y-8">
      {/* 1. Profile Selector */}
      <section className={`${saCard} p-5 sm:p-6`}>
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Profiles</h2>
          <p className="mt-1 text-sm text-slate-500">
            Choose which profiles feed every KPI and chart below. All profiles are selected by
            default.
          </p>
        </div>
        <SuperAdminProfileMultiSelect
          options={profileOptions}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          disabled={!profileOptions.length}
        />
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {!selectedIds.length ? (
        <div className={`${saCard} px-5 py-10 text-center text-sm text-slate-500`}>
          Select at least one profile to view analytics.
        </div>
      ) : (
        <>
          {/* 2. Analytics Overview — Circular KPI Cards */}
          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">Overview</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Fixed calendar periods — independent of the date range below.
                </p>
              </div>
              {loadingOverview ? (
                <span className={`${saMono} text-[11px] text-slate-400`}>Updating…</span>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {overviewCards.map((card) => (
                <SuperAdminDonutKpi
                  key={card.key}
                  title={card.title}
                  total={card.bucket.total}
                  segments={bucketToSegments(
                    card.bucket,
                    selectedIds,
                    orderedIds,
                    optionsById
                  )}
                  size="md"
                />
              ))}
            </div>
          </section>

          {/* 3. Date Range Selector */}
          <section className={`${saCard} p-5 sm:p-6`}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">Date range</h2>
              <p className="mt-1 text-sm text-slate-500">
                Controls the trend chart and the selected-period summary. Does not change Overview
                KPIs.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={preset === p.id ? saChipActive : saChip}
                  onClick={() => setPreset(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {preset === "custom" ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={saLabel} htmlFor="analytics-from">
                    Start
                  </label>
                  <input
                    id="analytics-from"
                    type="date"
                    className={saField}
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className={saLabel} htmlFor="analytics-to">
                    End
                  </label>
                  <input
                    id="analytics-to"
                    type="date"
                    className={saField}
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>
              </div>
            ) : null}
            <p className={`${saMono} mt-3 text-[11px] text-slate-400`}>{rangeLabel}</p>
          </section>

          {/* 4. Interactive Multi-Series Line Chart */}
          <section className={`${saCard} p-5 sm:p-6`}>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                  Daily trend
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Dotted lines per profile · solid SUM · hover any day for a shared breakdown.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={`${saBtnGhost} h-8 px-3 text-[10px]`} onClick={showAllLines}>
                  Show all
                </button>
                <button type="button" className={`${saBtnGhost} h-8 px-3 text-[10px]`} onClick={hideAllLines}>
                  Hide all
                </button>
                <button
                  type="button"
                  className={`${saBtnPrimary} h-8 px-3 text-[10px]`}
                  onClick={() => void loadCompare()}
                  disabled={loadingCompare}
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-5 lg:flex-row">
              <div className="min-w-0 flex-1" style={{ height: 360 }}>
                {loadingCompare && !compare ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    Loading chart…
                  </div>
                ) : chartRows.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    No daily data for this range.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartRows} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 6" stroke="rgba(148,163,184,0.35)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "rgba(148,163,184,0.4)" }}
                        minTickGap={28}
                        tickFormatter={(v: string) => {
                          const d = new Date(`${v}T12:00:00`);
                          return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                        }}
                      />
                      <YAxis
                        domain={[0, yMax]}
                        allowDecimals={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={40}
                      />
                      <Tooltip
                        content={<LineTooltip optionsById={optionsById} />}
                        cursor={{ stroke: "rgba(15,23,42,0.18)", strokeWidth: 1 }}
                      />
                      <Legend content={() => null} />
                      {selectedIds.map((id) => (
                        <Line
                          key={id}
                          type="monotone"
                          dataKey={id}
                          name={profileLabel(optionsById.get(id), id)}
                          stroke={colorForProfileId(id, orderedIds)}
                          strokeWidth={1.75}
                          strokeDasharray="5 4"
                          dot={{ r: 2.5, strokeWidth: 0 }}
                          activeDot={{ r: 4.5 }}
                          hide={hiddenKeys.has(id)}
                          isAnimationActive
                          animationDuration={500}
                          connectNulls
                        />
                      ))}
                      <Line
                        type="monotone"
                        dataKey={TOTAL_SERIES_KEY}
                        name="SUM"
                        stroke={TOTAL_SERIES_COLOR}
                        strokeWidth={3}
                        dot={{ r: 3, strokeWidth: 0, fill: TOTAL_SERIES_COLOR }}
                        activeDot={{ r: 5.5 }}
                        hide={hiddenKeys.has(TOTAL_SERIES_KEY)}
                        isAnimationActive
                        animationDuration={500}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Line visibility legend */}
              <aside className="w-full shrink-0 lg:w-56">
                <p className={`${saLabel} mb-2`}>Visible lines</p>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleLine(TOTAL_SERIES_KEY)}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition ${
                      hiddenKeys.has(TOTAL_SERIES_KEY)
                        ? "bg-slate-50 text-slate-400"
                        : "bg-slate-100/80 text-slate-900"
                    }`}
                  >
                    <span
                      className="h-0.5 w-5 rounded-full"
                      style={{ background: TOTAL_SERIES_COLOR, height: 3 }}
                    />
                    <span className="font-semibold">SUM</span>
                  </button>
                  {selectedIds.map((id) => {
                    const hidden = hiddenKeys.has(id);
                    const color = colorForProfileId(id, orderedIds);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleLine(id)}
                        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition ${
                          hidden ? "bg-slate-50 text-slate-400" : "hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        <span
                          className="inline-block w-5 border-t-2 border-dashed"
                          style={{ borderColor: color }}
                        />
                        <span className="truncate">
                          {profileLabel(optionsById.get(id), id)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </aside>
            </div>
          </section>

          {/* 5. Selected Period Summary — Circular KPI */}
          <section className={`${saCard} p-5 sm:p-6`}>
            <div className="mb-5">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                Selected period
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Grand total for {rangeLabel}
                {loading ? " · updating…" : ""}.
              </p>
            </div>
            <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center lg:gap-14">
              <SuperAdminDonutKpi
                title="Period total"
                subtitle={rangeLabel}
                total={periodTotal}
                segments={periodSegments}
                size="lg"
              />
              <div className="w-full max-w-md min-w-0 flex-1">
                <p className={`${saLabel} mb-3`}>Breakdown</p>
                {periodRankings.length === 0 ? (
                  <p className="text-sm text-slate-400">No profiles in range.</p>
                ) : (
                  <ul className="space-y-2">
                    {periodRankings.map((row, index) => {
                      const pct =
                        periodTotal > 0
                          ? Math.round((row.value / periodTotal) * 1000) / 10
                          : 0;
                      return (
                        <li
                          key={row.id}
                          className="flex items-center gap-3 rounded-2xl bg-slate-50/80 px-3 py-2.5"
                        >
                          <span
                            className={`${saMono} w-5 shrink-0 text-[11px] text-slate-400`}
                          >
                            {index + 1}
                          </span>
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: row.color }}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                            {row.name}
                          </span>
                          <span className={`${saMono} text-sm font-semibold text-slate-900`}>
                            {row.value.toLocaleString()}
                          </span>
                          <span className={`${saMono} w-12 text-right text-[11px] text-slate-400`}>
                            {pct}%
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </>
      )}
      </div>
    </div>
  );
}
