/** How often an active browser tab reports activity. */
export const HEARTBEAT_INTERVAL_MS = 60_000;
/** A tab stops reporting once the user has not touched it for this long. */
export const CLIENT_IDLE_AFTER_MS = 5 * 60_000;

export type ActivityToday = {
  /** ISO timestamp of the first check-in today, or null. */
  checkedInAt: string | null;
  activeSeconds: number;
};

/** "2h 05m", "45m" or "<1m". */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return "<1m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
