import { endOfDay, endOfMonth, endOfWeek, startOfDay, startOfMonth, startOfWeek } from "date-fns";

/** Parses a YYYY-MM-DD string as a local-time date at midnight. */
export function parseDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function today(): Date {
  return startOfDay(new Date());
}

export function todayRange() {
  const now = new Date();
  return { gte: startOfDay(now), lte: endOfDay(now) };
}

export function thisWeekRange() {
  const now = new Date();
  return { gte: startOfWeek(now, { weekStartsOn: 1 }), lte: endOfWeek(now, { weekStartsOn: 1 }) };
}

export function monthRange(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  return { gte: startOfMonth(first), lte: endOfMonth(first) };
}

/**
 * A sensible default due date inside a month: today for the current month,
 * the 1st for future months and the last day for past months.
 */
export function defaultDueDateInMonth(year: number, month: number): Date {
  const now = new Date();
  const first = new Date(year, month - 1, 1);
  if (now.getFullYear() === year && now.getMonth() + 1 === month) return startOfDay(now);
  return first < now ? endOfMonth(first) : first;
}
