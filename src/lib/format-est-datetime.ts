export const EST_TZ = "America/New_York";

const EST_PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: EST_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZoneName: "short",
});

const EST_YMD_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: EST_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type EstDateTimeParts = {
  date: string;
  time: string;
  zone: string;
  combined: string;
};

function parseIso(iso: string): Date | null {
  try {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function pick(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

/** Format an ISO timestamp for display in US Eastern Time (EST/EDT). */
export function formatEstDateTime(iso: string): string | null {
  const parts = formatEstDateTimeParts(iso);
  return parts?.combined ?? null;
}

/**
 * Example: `2026/09/08 Tue 2:04 PM EDT`
 */
export function formatEstDateTimeParts(iso: string): EstDateTimeParts | null {
  const date = parseIso(iso);
  if (!date) return null;

  const parts = EST_PARTS_FORMATTER.formatToParts(date);
  const year = pick(parts, "year");
  const month = pick(parts, "month");
  const day = pick(parts, "day");
  const weekday = pick(parts, "weekday");
  const hour = pick(parts, "hour");
  const minute = pick(parts, "minute");
  const dayPeriod = pick(parts, "dayPeriod");
  const zone = pick(parts, "timeZoneName") || "ET";

  const dateLabel = `${year}/${month}/${day} ${weekday}`.trim();
  const timeLabel = `${hour}:${minute} ${dayPeriod}`.trim();

  return {
    date: dateLabel,
    time: timeLabel,
    zone,
    combined: `${dateLabel} ${timeLabel} ${zone}`.replace(/\s+/g, " ").trim(),
  };
}

/** Calendar date in US Eastern as `YYYY-MM-DD` (for date inputs / filters). */
export function formatEstYmd(date: Date = new Date()): string {
  return EST_YMD_FORMATTER.format(date);
}

/** True when the ISO timestamp falls on the given Eastern calendar day (`YYYY-MM-DD`). */
export function isIsoOnEstYmd(iso: string, ymd: string): boolean {
  const date = parseIso(iso);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  return formatEstYmd(date) === ymd;
}

/** Compact Eastern time only, e.g. `3:30 PM EDT`. */
export function formatEstTime(iso: string): string | null {
  const parts = formatEstDateTimeParts(iso);
  if (!parts) return null;
  return `${parts.time} ${parts.zone}`.trim();
}
