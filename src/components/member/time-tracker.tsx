"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Play, Square, Timer } from "lucide-react";
import { toast } from "sonner";
import { getTaskTime, startTimer, stopTimer, type TaskTime } from "@/actions/time-tracking";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

/**
 * "0h 03m 53s · Start timer / Stop timer" for a task. The clock ticks locally
 * while the current user's timer runs; totals come from the server.
 */
export function TimeTracker({ taskId, canTrack, initial }: { taskId: string; canTrack: boolean; initial?: TaskTime | null }) {
  const [time, setTime] = useState<TaskTime | null>(initial ?? null);
  // Wall clock, advanced by the interval while a timer runs (never read Date.now() during render).
  const [nowMs, setNowMs] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    getTaskTime(taskId).then((r) => {
      if (!cancelled && r.ok) setTime(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [taskId, initial]);

  const running = Boolean(time?.runningSince);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Seconds elapsed on my running timer since the server snapshot.
  const extra = time?.runningSince && nowMs ? Math.max(0, Math.floor((nowMs - new Date(time.now).getTime()) / 1000)) : 0;
  const total = (time?.totalSeconds ?? 0) + extra;
  const mine = (time?.mySeconds ?? 0) + extra;

  function toggle() {
    startTransition(async () => {
      const result = running ? await stopTimer(taskId) : await startTimer(taskId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTime(result.data);
      toast.success(running ? `Logged ${formatDuration(mine)}` : "Timer started");
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn("inline-flex items-center gap-2 font-mono text-lg font-semibold tabular-nums", running && "text-primary")}>
          <Timer className={cn("size-4", running && "animate-pulse")} />
          {time ? formatDuration(total) : "—"}
        </span>
        {canTrack && (
          <Button size="sm" variant={running ? "destructive" : "default"} disabled={pending || !time} onClick={toggle}>
            {pending ? <Loader2 className="animate-spin" /> : running ? <Square /> : <Play />}
            {running ? "Stop timer" : "Start timer"}
          </Button>
        )}
      </div>
      {time && time.byUser.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {time.byUser.map((u) => (
            <li key={u.userId} className={cn(u.running && "text-primary")}>
              {u.name}: {formatDuration(u.seconds + (u.running && time.runningSince && u.userId === time.byUser.find((x) => x.running)?.userId ? extra : 0))}
              {u.running && " · running"}
            </li>
          ))}
        </ul>
      )}
      {time && time.byUser.length === 0 && <p className="text-xs text-muted-foreground">No time logged yet. Press Start timer when you begin working.</p>}
    </div>
  );
}
