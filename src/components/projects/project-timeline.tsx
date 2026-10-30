import Link from "next/link";
import { addDays, differenceInCalendarDays, eachDayOfInterval, format, isToday, isWeekend, max, min, startOfDay } from "date-fns";
import { Flag } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { STATUS_COLORS, STATUS_LABELS, TASK_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ProjectDetail, ProjectTask } from "@/lib/queries/projects";

const DAY_PX = 28;
const LABEL_PX = 220;

type Milestone = ProjectDetail["project"]["milestones"][number];

/**
 * Gantt-style timeline: one row per task (grouped by list), bars from the
 * start date (or the due date when there is none) to the due date, milestone
 * markers on top and a line for today. Pure CSS, scrolls horizontally.
 */
export function ProjectTimeline({
  project,
  tasks,
  milestones,
  lists,
  taskHref,
}: {
  project: { startDate: Date | null; dueDate: Date | null; color: string };
  tasks: ProjectTask[];
  milestones: Milestone[];
  lists: { id: string; name: string }[];
  taskHref: string;
}) {
  if (tasks.length === 0 && milestones.length === 0) {
    return <EmptyState title="Nothing to plot yet" description="Add tasks with start and due dates (and milestones) to see the project timeline." />;
  }

  const today = startOfDay(new Date());
  const dates = [
    ...tasks.flatMap((t) => [t.startDate ?? t.dueDate, t.dueDate]),
    ...milestones.flatMap((m) => (m.dueDate ? [m.dueDate] : [])),
    ...(project.startDate ? [project.startDate] : []),
    ...(project.dueDate ? [project.dueDate] : []),
    today,
  ].map((d) => startOfDay(d));
  const rangeStart = addDays(min(dates), -2);
  const rangeEnd = addDays(max(dates), 3);
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  const width = days.length * DAY_PX;
  const x = (d: Date) => differenceInCalendarDays(startOfDay(d), rangeStart) * DAY_PX;

  // Month header segments.
  const months: { label: string; span: number }[] = [];
  for (const d of days) {
    const label = format(d, "MMMM yyyy");
    const last = months[months.length - 1];
    if (last && last.label === label) last.span += 1;
    else months.push({ label, span: 1 });
  }

  const groups: { key: string; name: string; tasks: ProjectTask[] }[] = [
    ...lists.map((l) => ({ key: l.id, name: l.name, tasks: tasks.filter((t) => t.listId === l.id) })),
  ];
  const unsorted = tasks.filter((t) => !t.listId || !lists.some((l) => l.id === t.listId));
  if (unsorted.length > 0) groups.unshift({ key: "unsorted", name: "Unsorted", tasks: unsorted });

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <div style={{ minWidth: LABEL_PX + width }}>
          {/* Month + day header */}
          <div className="sticky top-0 z-10 border-b bg-card">
            <div className="flex">
              <div className="shrink-0 border-r" style={{ width: LABEL_PX }} />
              <div className="flex">
                {months.map((m) => (
                  <div key={m.label} className="truncate border-r px-2 py-1 text-xs font-medium" style={{ width: m.span * DAY_PX }}>
                    {m.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex">
              <div className="shrink-0 border-r px-3 py-1 text-xs text-muted-foreground" style={{ width: LABEL_PX }}>
                Task
              </div>
              <div className="flex">
                {days.map((d) => (
                  <div
                    key={d.toISOString()}
                    className={cn(
                      "flex flex-col items-center border-r py-0.5 text-[10px] leading-tight text-muted-foreground",
                      isWeekend(d) && "bg-muted/50",
                      isToday(d) && "bg-primary/10 font-semibold text-primary",
                    )}
                    style={{ width: DAY_PX }}
                  >
                    <span>{format(d, "d")}</span>
                    <span>{format(d, "EEEEE")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Milestones row */}
          {milestones.length > 0 && (
            <div className="flex border-b bg-muted/20">
              <div className="shrink-0 border-r px-3 py-2 text-xs font-medium" style={{ width: LABEL_PX }}>
                Milestones
              </div>
              <div className="relative h-9" style={{ width }}>
                <Grid days={days} />
                {milestones
                  .filter((m) => m.dueDate)
                  .map((m) => (
                    <span
                      key={m.id}
                      title={`${m.title} · ${format(m.dueDate!, "MMM d")}${m.completedAt ? " · reached" : ""}`}
                      className={cn(
                        "absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border bg-background px-1.5 py-0.5 text-[10px] whitespace-nowrap",
                        m.completedAt ? "border-emerald-400 text-emerald-700 dark:text-emerald-300" : "border-primary/40 text-foreground",
                      )}
                      style={{ left: x(m.dueDate!) + DAY_PX / 2 }}
                    >
                      <Flag className="size-3" /> {m.title}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Project span */}
          {(project.startDate || project.dueDate) && (
            <div className="flex border-b">
              <div className="shrink-0 border-r px-3 py-2 text-xs font-medium" style={{ width: LABEL_PX }}>
                Project
              </div>
              <div className="relative h-8" style={{ width }}>
                <Grid days={days} />
                <span
                  className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full opacity-70"
                  style={{
                    left: x(project.startDate ?? project.dueDate!),
                    width: Math.max(DAY_PX, (differenceInCalendarDays(project.dueDate ?? project.startDate!, project.startDate ?? project.dueDate!) + 1) * DAY_PX),
                    backgroundColor: project.color,
                  }}
                />
              </div>
            </div>
          )}

          {groups.map((g) => (
            <div key={g.key}>
              <div className="flex border-b bg-muted/30">
                <div className="shrink-0 border-r px-3 py-1.5 text-xs font-semibold" style={{ width: LABEL_PX }}>
                  {g.name} <span className="font-normal text-muted-foreground">{g.tasks.length}</span>
                </div>
                <div className="relative" style={{ width }}>
                  <Grid days={days} />
                </div>
              </div>
              {g.tasks.map((t) => {
                const start = t.startDate ?? t.dueDate;
                const span = Math.max(1, differenceInCalendarDays(t.dueDate, start) + 1);
                return (
                  <div key={t.id} className="flex border-b last:border-b-0">
                    <div className="flex shrink-0 items-center gap-2 border-r px-3 py-1.5" style={{ width: LABEL_PX }}>
                      <Link
                        href={`${taskHref}/${t.id}`}
                        className={cn("min-w-0 flex-1 truncate text-xs hover:underline", t.status === "COMPLETED" && "text-muted-foreground line-through")}
                        title={t.title}
                      >
                        {t.title}
                      </Link>
                    </div>
                    <div className="relative h-8" style={{ width }}>
                      <Grid days={days} />
                      <Link
                        href={`${taskHref}/${t.id}`}
                        title={`${t.title} · ${format(start, "MMM d")} → ${format(t.dueDate, "MMM d")} · ${STATUS_LABELS[t.status]} · ${t.completion}%`}
                        className="absolute top-1/2 flex h-5 -translate-y-1/2 items-center overflow-hidden rounded-md text-[10px] text-white shadow-xs"
                        style={{ left: x(start) + 2, width: span * DAY_PX - 4, backgroundColor: STATUS_COLORS[t.status] }}
                      >
                        <span className="absolute inset-y-0 left-0 bg-black/20" style={{ width: `${t.completion}%` }} />
                        <span className="relative truncate px-1.5">{t.assignees.map((a) => a.user.name.split(" ")[0]).join(", ")}</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {TASK_STATUSES.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: STATUS_COLORS[s] }} />
            {STATUS_LABELS[s]}
          </span>
        ))}
        <span>Darker part of a bar = completion %. Tasks without a start date show on their due date.</span>
      </div>
    </div>
  );
}

function Grid({ days }: { days: Date[] }) {
  return (
    <div className="absolute inset-0 flex">
      {days.map((d) => (
        <div
          key={d.toISOString()}
          className={cn("h-full border-r border-border/60", isWeekend(d) && "bg-muted/40", isToday(d) && "border-l-2 border-l-primary bg-primary/5")}
          style={{ width: DAY_PX }}
        />
      ))}
    </div>
  );
}
