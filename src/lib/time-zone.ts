import "server-only";

/**
 * Time zone that defines "a day" for attendance and the times shown to admins.
 * Defaults to Asia/Karachi; override with APP_TIME_ZONE. The server itself runs in UTC on Vercel,
 * so never fall back to the server's own zone.
 */
export const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Asia/Karachi";

const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

function zonedParts(date: Date) {
  const out: Record<string, number> = {};
  for (const p of partsFormat.formatToParts(date)) if (p.type !== "literal") out[p.type] = Number(p.value);
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Offset of APP_TIME_ZONE from UTC at the given instant, in ms. */
function offsetAt(date: Date): number {
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - (date.getTime() - date.getMilliseconds());
}

const pad = (n: number) => String(n).padStart(2, "0");

/** yyyy-MM-dd of the instant in APP_TIME_ZONE. */
export function dayKey(date = new Date()): string {
  const p = zonedParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function isDayKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** Shifts a yyyy-MM-dd key by whole days. */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** The instant at which the given day starts in APP_TIME_ZONE. */
export function startOfDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d);
  let t = wall - offsetAt(new Date(wall));
  // Re-check once in case the offset changes (DST) between the guess and the result.
  const corrected = wall - offsetAt(new Date(t));
  if (corrected !== t) t = corrected;
  return new Date(t);
}

/** Prisma range filter covering the whole day. */
export function dayKeyRange(key: string) {
  return { gte: startOfDayKey(key), lt: startOfDayKey(addDays(key, 1)) };
}

const clockFormat = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, hour: "numeric", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

/** "9:05 AM" in APP_TIME_ZONE. */
export function formatClock(date: Date | null | undefined): string {
  return date ? clockFormat.format(date) : "—";
}

/** "Monday, October 26, 2026" for a yyyy-MM-dd key. */
export function formatDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayFormat.format(new Date(Date.UTC(y, m - 1, d)));
}
