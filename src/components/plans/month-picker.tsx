"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryState } from "@/hooks/use-query-state";
import { MONTH_NAMES } from "@/lib/constants";
import { monthKey } from "@/lib/utils";

/** Prev / next month navigation driven by the `month` search param (yyyy-MM). */
export function MonthPicker({ year, month }: { year: number; month: number }) {
  const { set } = useQueryState();
  const now = new Date();
  const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1;

  const go = (offset: number) => {
    const d = new Date(year, month - 1 + offset, 1);
    set({ month: monthKey(d.getFullYear(), d.getMonth() + 1) });
  };

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => go(-1)}>
        <ChevronLeft />
      </Button>
      <span className="min-w-36 text-center text-sm font-medium tabular-nums">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <Button variant="outline" size="icon" aria-label="Next month" onClick={() => go(1)}>
        <ChevronRight />
      </Button>
      {!isCurrent && (
        <Button variant="ghost" size="sm" onClick={() => set({ month: null })}>
          This month
        </Button>
      )}
    </div>
  );
}
