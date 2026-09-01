const EST_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const EST_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const EST_ZONE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  timeZoneName: "short",
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

/** Format an ISO timestamp for display in US Eastern Time (EST/EDT). */
export function formatEstDateTime(iso: string): string | null {
  const parts = formatEstDateTimeParts(iso);
  return parts?.combined ?? null;
}

export function formatEstDateTimeParts(iso: string): EstDateTimeParts | null {
  const date = parseIso(iso);
  if (!date) return null;

  const zone =
    EST_ZONE_FORMATTER.formatToParts(date).find((part) => part.type === "timeZoneName")?.value ?? "ET";

  const dateLabel = EST_DATE_FORMATTER.format(date);
  const timeLabel = EST_TIME_FORMATTER.format(date);

  return {
    date: dateLabel,
    time: timeLabel,
    zone,
    combined: `${dateLabel} · ${timeLabel} ${zone}`,
  };
}
