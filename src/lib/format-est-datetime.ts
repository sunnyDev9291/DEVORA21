const EST_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
  timeZoneName: "short",
});

/** Format an ISO timestamp for display in US Eastern Time (EST/EDT). */
export function formatEstDateTime(iso: string): string | null {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return EST_FORMATTER.format(date);
  } catch {
    return null;
  }
}
