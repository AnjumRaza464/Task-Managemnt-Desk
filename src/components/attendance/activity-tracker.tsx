"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import {
  CLIENT_IDLE_AFTER_MS,
  HEARTBEAT_INTERVAL_MS,
  formatDuration,
  type ActivityToday,
} from "@/lib/attendance-types";

const INPUT_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "scroll", "touchstart"] as const;

/**
 * Reports activity while this tab is visible and in use, and shows the user
 * their check-in time and active time for today.
 */
export function ActivityTracker() {
  const [today, setToday] = useState<ActivityToday | null>(null);

  useEffect(() => {
    let lastInput = Date.now();
    let inFlight = false;
    const markInput = () => {
      lastInput = Date.now();
    };

    const beat = async () => {
      if (inFlight || document.visibilityState !== "visible") return;
      if (Date.now() - lastInput > CLIENT_IDLE_AFTER_MS) return;
      inFlight = true;
      try {
        const res = await fetch("/api/activity", { method: "POST", cache: "no-store" });
        if (res.ok) setToday(await res.json());
      } catch {
        // Offline or signed out; the next beat retries.
      } finally {
        inFlight = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      markInput();
      void beat();
    };

    for (const e of INPUT_EVENTS) window.addEventListener(e, markInput, { passive: true, capture: true });
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(beat, HEARTBEAT_INTERVAL_MS);
    void beat();

    return () => {
      for (const e of INPUT_EVENTS) window.removeEventListener(e, markInput, { capture: true });
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, []);

  if (!today?.checkedInAt) return null;
  const since = new Date(today.checkedInAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div
      className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground"
      title={`Checked in at ${since} · ${formatDuration(today.activeSeconds)} active today`}
    >
      <Timer className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      <span className="hidden sm:inline">In since {since} ·</span>
      <span className="font-medium tabular-nums text-foreground">{formatDuration(today.activeSeconds)}</span>
    </div>
  );
}
