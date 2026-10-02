import { format, formatDistanceToNow, isValid } from "date-fns";

export { cn } from "cn";

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatDate(value: Date | string | null | undefined, pattern = "MMM d, yyyy"): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return isValid(date) ? format(date, pattern) : "—";
}

export function formatDateTime(value: Date | string | null | undefined): string {
  return formatDate(value, "MMM d, yyyy 'at' h:mm a");
}

export function timeAgo(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return formatDistanceToNow(date, { addSuffix: true });
}

/** yyyy-MM-dd for <input type="date"> values. */
export function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return isValid(date) ? format(date, "yyyy-MM-dd") : "";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseMonthKey(key: string | undefined | null): { year: number; month: number } {
  const now = new Date();
  const fallback = { year: now.getFullYear(), month: now.getMonth() + 1 };
  if (!key) return fallback;
  const match = /^(\d{4})-(\d{1,2})$/.exec(key);
  if (!match) return fallback;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return fallback;
  return { year, month };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function percent(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}
