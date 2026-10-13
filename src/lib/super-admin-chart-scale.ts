/** Y-axis max so the highest visible value sits near 70% of plotting height. */
export function computeYAxisMax(highestVisible: number, defaultMax = 10): number {
  if (!Number.isFinite(highestVisible) || highestVisible <= 0) return defaultMax;
  return niceCeil(highestVisible / 0.7);
}

/** Round upward to a clean tick (1 / 2 / 5 × 10^n). */
export function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  if (value <= 1) return 1;
  const exp = Math.floor(Math.log10(value));
  const factor = 10 ** exp;
  const mantissa = value / factor;
  const nice = mantissa <= 1 ? 1 : mantissa <= 2 ? 2 : mantissa <= 5 ? 5 : 10;
  return Math.round(nice * factor);
}

export const PROFILE_CHART_COLORS = [
  "#2dd4bf",
  "#38bdf8",
  "#a78bfa",
  "#f472b6",
  "#fbbf24",
  "#34d399",
  "#fb7185",
  "#22d3ee",
  "#c084fc",
  "#4ade80",
  "#f59e0b",
  "#60a5fa",
] as const;

export const TOTAL_SERIES_COLOR = "#f8fafc";
export const TOTAL_SERIES_KEY = "__total__";

export function colorForProfileIndex(index: number): string {
  return PROFILE_CHART_COLORS[index % PROFILE_CHART_COLORS.length];
}

export function formatLocalDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function resolveDateRange(
  preset: "today" | "last7" | "last30" | "month" | "all" | "custom",
  from: string,
  to: string
): { preset: string; from?: string; to?: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (preset === "custom") {
    return { preset: "custom", from: from || undefined, to: to || undefined };
  }
  if (preset === "today") {
    const d = formatLocalDateInput(today);
    return { preset: "today", from: d, to: d };
  }
  if (preset === "last7") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return {
      preset: "custom",
      from: formatLocalDateInput(start),
      to: formatLocalDateInput(today),
    };
  }
  if (preset === "last30") {
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    return {
      preset: "custom",
      from: formatLocalDateInput(start),
      to: formatLocalDateInput(today),
    };
  }
  if (preset === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      preset: "month",
      from: formatLocalDateInput(start),
      to: formatLocalDateInput(today),
    };
  }
  return { preset: "all" };
}
