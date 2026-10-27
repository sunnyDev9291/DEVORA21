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

/** Calendar date in an IANA timezone as `YYYY-MM-DD`. */
export function formatYmdInTimezone(date: Date = new Date(), timeZone: string = EST_TZ): string {
  const tz = timeZone.trim() || EST_TZ;
  if (tz === EST_TZ) return formatEstYmd(date);
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return formatEstYmd(date);
  }
}

/** True when the ISO timestamp falls on the given Eastern calendar day (`YYYY-MM-DD`). */
export function isIsoOnEstYmd(iso: string, ymd: string): boolean {
  return isIsoOnYmd(iso, ymd, EST_TZ);
}

/**
 * Offset (ms) such that `utcMs + offset ≈ wall clock in timeZone` as if read in UTC parts.
 * Used to convert a zoned wall midnight into a UTC instant.
 */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = dtf.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "0";
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    hour,
    Number(get("minute")),
    Number(get("second"))
  );
  return asUtc - date.getTime();
}

/**
 * Half-open UTC bounds for a calendar day in an IANA zone: [start, end).
 * Matches backend `zonedDayBoundsUtc` semantics.
 */
export function zonedDayBoundsUtc(
  ymd: string,
  timeZone: string = EST_TZ
): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const tz = timeZone.trim() || EST_TZ;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;

  const wallMidnightUtcMs = (yy: number, mm: number, dd: number): number => {
    // Iterate: UTC guess for local midnight, correct by zone offset at that instant.
    let utc = Date.UTC(yy, mm - 1, dd, 0, 0, 0);
    for (let i = 0; i < 4; i++) {
      const offset = timeZoneOffsetMs(new Date(utc), tz);
      utc = Date.UTC(yy, mm - 1, dd, 0, 0, 0) - offset;
    }
    return utc;
  };

  const startMs = wallMidnightUtcMs(y, m, d);
  // Next calendar day (Date.UTC rolls months/years).
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const endMs = wallMidnightUtcMs(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate()
  );

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return null;
  }
  return { start: new Date(startMs), end: new Date(endMs) };
}

/**
 * True when ISO UTC instant is in the selected zoned calendar day: start <= t < end.
 * Prefer this over string YMD equality for SSE/list membership (matches backend).
 */
export function isIsoInZonedDay(
  iso: string,
  ymd: string,
  timeZone: string = EST_TZ
): boolean {
  const date = parseIso(iso);
  if (!date) return false;
  const bounds = zonedDayBoundsUtc(ymd, timeZone);
  if (!bounds) return false;
  const t = date.getTime();
  return t >= bounds.start.getTime() && t < bounds.end.getTime();
}

/** True when the ISO timestamp falls on `ymd` in the given IANA timezone. */
export function isIsoOnYmd(iso: string, ymd: string, timeZone: string = EST_TZ): boolean {
  return isIsoInZonedDay(iso, ymd, timeZone);
}

/** Compact Eastern time only, e.g. `3:30 PM EDT`. */
export function formatEstTime(iso: string): string | null {
  const parts = formatEstDateTimeParts(iso);
  if (!parts) return null;
  return `${parts.time} ${parts.zone}`.trim();
}
