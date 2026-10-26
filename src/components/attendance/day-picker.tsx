"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQueryState } from "@/hooks/use-query-state";

/** Prev / next day navigation driven by the `date` search param (yyyy-MM-dd). */
export function DayPicker({
  date,
  prev,
  next,
  today,
}: {
  date: string;
  prev: string;
  next: string;
  today: string;
}) {
  const { set } = useQueryState();
  const isToday = date === today;
  const go = (value: string) => set({ date: value === today ? null : value });

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => go(prev)}>
        <ChevronLeft />
      </Button>
      <Input
        type="date"
        aria-label="Day"
        className="w-40 tabular-nums"
        value={date}
        max={today}
        onChange={(e) => e.target.value && go(e.target.value)}
      />
      <Button variant="outline" size="icon" aria-label="Next day" disabled={isToday} onClick={() => go(next)}>
        <ChevronRight />
      </Button>
      {!isToday && (
        <Button variant="ghost" size="sm" onClick={() => go(today)}>
          Today
        </Button>
      )}
    </div>
  );
}
