"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

/**
 * Shows a clock time in the viewer's own time zone. During server rendering
 * and hydration it shows `fallback` (formatted in APP_TIME_ZONE), then swaps
 * to the browser's local time once mounted, so there is no hydration mismatch.
 */
export function LocalTime({ date, fallback }: { date: Date | string | null | undefined; fallback: string }) {
  const value = date ? new Date(date) : null;
  const text = useSyncExternalStore(
    subscribe,
    () => (value ? clock.format(value) : fallback),
    () => fallback,
  );
  if (!value) return <>{fallback}</>;
  return <time dateTime={value.toISOString()}>{text}</time>;
}
