import Link from "next/link";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { STATUS_COLORS, STATUS_LABELS, TASK_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { TaskListItem } from "@/lib/queries/tasks";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_VISIBLE = 3;

export function MonthGrid({ year, month, tasks }: { year: number; month: number; tasks: TaskListItem[] }) {
  const first = new Date(year, month - 1, 1);
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(first), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(first), { weekStartsOn: 1 }),
  });

  const byDay = new Map<string, TaskListItem[]>();
  for (const task of tasks) {
    const key = format(task.dueDate, "yyyy-MM-dd");
    (byDay.get(key) ?? byDay.set(key, []).get(key)!).push(task);
  }

  return (
    <div className="space-y-3">
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
            const inMonth = isSameMonth(day, first);
            const today = isToday(day);
            const hidden = items.length - MAX_VISIBLE;
            return (
              <div
                key={key}
                className={cn(
                  "flex min-h-24 flex-col gap-1 border-b border-r p-1.5 sm:min-h-28",
                  (i + 1) % 7 === 0 && "border-r-0",
                  i >= days.length - 7 && "border-b-0",
                  !inMonth && "bg-muted/30 text-muted-foreground",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                      today && "bg-primary font-semibold text-primary-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {items.length > 0 && <span className="text-[10px] text-muted-foreground">{items.length}</span>}
                </div>
                <div className="flex flex-col gap-1">
                  {items.slice(0, MAX_VISIBLE).map((task) => (
                    <Link
                      key={task.id}
                      href={`/tasks/${task.id}`}
                      title={`${task.title} · ${task.assignee.name} · ${STATUS_LABELS[task.status]}`}
                      className={cn(
                        "block truncate rounded-sm border-l-2 bg-muted/60 px-1.5 py-0.5 text-[11px] leading-tight transition-colors hover:bg-accent",
                        task.status === "COMPLETED" && "text-muted-foreground line-through",
                        task.status === "CANCELLED" && "text-muted-foreground/70 line-through",
                      )}
                      style={{ borderLeftColor: STATUS_COLORS[task.status] }}
                    >
                      {task.title}
                    </Link>
                  ))}
                  {hidden > 0 && (
                    <Link
                      href={`/tasks?dueFrom=${key}&dueTo=${key}`}
                      className="px-1.5 text-[11px] font-medium text-primary hover:underline"
                    >
                      +{hidden} more
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {TASK_STATUSES.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className="h-3 w-1 rounded-sm" style={{ backgroundColor: STATUS_COLORS[s] }} />
            {STATUS_LABELS[s]}
          </span>
        ))}
      </div>
    </div>
  );
}
