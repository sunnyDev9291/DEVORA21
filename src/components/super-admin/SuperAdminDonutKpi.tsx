"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export type DonutSegment = {
  id: string;
  name: string;
  value: number;
  color: string;
};

type SuperAdminDonutKpiProps = {
  title: string;
  subtitle?: string;
  total: number;
  segments: DonutSegment[];
  size?: "sm" | "md" | "lg";
  /** Optional footnote under the chart */
  footnote?: string;
};

const SIZES = {
  sm: { box: 148, inner: 48, outer: 64, center: "1.65rem", label: "0.72rem" },
  md: { box: 176, inner: 56, outer: 76, center: "1.9rem", label: "0.75rem" },
  lg: { box: 220, inner: 72, outer: 96, center: "2.35rem", label: "0.78rem" },
} as const;

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: DonutSegment & { percent: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.97)",
        border: "1px solid rgba(15,23,42,0.08)",
        borderRadius: 12,
        padding: "10px 12px",
        boxShadow: "0 10px 28px rgba(15,23,42,0.12)",
        fontSize: "0.8rem",
        color: "#0f172a",
        minWidth: 160,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 99,
            background: row.color,
            flexShrink: 0,
          }}
        />
        <strong style={{ fontWeight: 600 }}>{row.name}</strong>
      </div>
      <div style={{ color: "#64748b" }}>
        {row.value.toLocaleString()} resume{row.value === 1 ? "" : "s"} · {row.percent}%
      </div>
    </div>
  );
}

export default function SuperAdminDonutKpi({
  title,
  subtitle,
  total,
  segments,
  size = "md",
  footnote,
}: SuperAdminDonutKpiProps) {
  const dim = SIZES[size];
  const positive = segments.filter((s) => s.value > 0);
  const chartData =
    positive.length > 0
      ? positive.map((s) => ({
          ...s,
          percent: total > 0 ? Math.round((s.value / total) * 1000) / 10 : 0,
        }))
      : [{ id: "_empty", name: "No data", value: 1, color: "#e2e8f0", percent: 0 }];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "18px 14px 16px",
        background: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(15,23,42,0.06)",
        borderRadius: 20,
        boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 12px 32px rgba(15,23,42,0.04)",
        minWidth: 0,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: "0.72rem",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#64748b",
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 2 }}>{subtitle}</div>
        ) : null}
      </div>

      <div style={{ position: "relative", width: dim.box, height: dim.box }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={dim.inner}
              outerRadius={dim.outer}
              paddingAngle={positive.length > 1 ? 2.5 : 0}
              stroke="none"
              isAnimationActive
              animationDuration={600}
            >
              {chartData.map((entry) => (
                <Cell key={entry.id} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontSize: dim.center,
              fontWeight: 650,
              letterSpacing: "-0.03em",
              color: "#0f172a",
              lineHeight: 1,
            }}
          >
            {total.toLocaleString()}
          </div>
          <div
            style={{
              fontSize: dim.label,
              color: "#94a3b8",
              marginTop: 4,
              fontWeight: 500,
            }}
          >
            resumes
          </div>
        </div>
      </div>

      {footnote ? (
        <div style={{ fontSize: "0.72rem", color: "#94a3b8", textAlign: "center" }}>
          {footnote}
        </div>
      ) : null}
    </div>
  );
}
