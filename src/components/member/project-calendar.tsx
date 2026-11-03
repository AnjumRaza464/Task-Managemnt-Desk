"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ProjectTask } from "@/lib/queries/projects";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Month calendar of a project's tasks by due date; clicking a task opens it. */
export function ProjectCalendar({ tasks, onOpen }: { tasks: ProjectTask[]; onOpen: (id: string) => void }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const days = eachDayOfInterval({
    start: startOfWeek(month, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const byDay = new Map<string, ProjectTask[]>();
  for (const t of tasks) {
    const key = format(t.dueDate, "yyyy-MM-dd");
    (byDay.get(key) ?? byDay.set(key, []).get(key)!).push(t);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="icon-sm" variant="outline" aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}>
          <ChevronLeft />
        </Button>
        <span className="min-w-36 text-center text-sm font-semibold">{format(month, "MMMM yyyy")}</span>
        <Button size="icon-sm" variant="outline" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}>
          <ChevronRight />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setMonth(startOfMonth(new Date()))}>
          Today
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const key = format(day, "yyyy-MM-dd");
            const items = byDay.get(key) ?? [];
            return (
              <div
                key={key}
                className={cn(
                  "flex min-h-20 flex-col gap-1 border-b border-r p-1.5 sm:min-h-24",
                  (i + 1) % 7 === 0 && "border-r-0",
                  i >= days.length - 7 && "border-b-0",
                  !isSameMonth(day, month) && "bg-muted/30 text-muted-foreground",
                )}
              >
                <span className={cn("flex size-6 items-center justify-center rounded-full text-xs tabular-nums", isToday(day) && "bg-primary font-semibold text-primary-foreground")}>
                  {format(day, "d")}
                </span>
                <div className="flex flex-col gap-1">
                  {items.slice(0, 3).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onOpen(t.id)}
                      title={`${t.title} · ${STATUS_LABELS[t.status]}`}
                      className={cn(
                        "truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium text-white",
                        t.status === "COMPLETED" && "line-through opacity-70",
                      )}
                      style={{ backgroundColor: STATUS_COLORS[t.status] }}
                    >
                      {t.title}
                    </button>
                  ))}
                  {items.length > 3 && <span className="px-1 text-[11px] text-muted-foreground">+{items.length - 3} more</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
