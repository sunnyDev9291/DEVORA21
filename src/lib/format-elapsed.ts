/** Format elapsed milliseconds as `12.4s` or `1m 05s`. */
export function formatElapsedMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0.0s";
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds - minutes * 60);
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

/** Digital stopwatch style `HH:MM:SS` (hours can exceed 99). */
export function formatElapsedHms(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");
}
