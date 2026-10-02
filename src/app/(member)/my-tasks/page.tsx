import type { Metadata } from "next";
import Link from "next/link";
import { CheckSquare, ListTodo, MessageSquare, Paperclip } from "lucide-react";
import { requireMemberPage } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { syncOverdueTasks } from "@/lib/overdue";
import { taskListInclude } from "@/lib/queries/tasks";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryBadge, PriorityBadge, StatusBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { MONTH_NAMES } from "@/lib/constants";
import { cn, formatDate, parseMonthKey } from "@/lib/utils";

export const metadata: Metadata = { title: "My tasks" };

export default async function MyTasksPage({ searchParams }: PageProps<"/my-tasks">) {
  const user = await requireMemberPage();
  await syncOverdueTasks();
  const params = await searchParams;
  const selected = typeof params.month === "string" ? params.month : "";

  const plans = await prisma.monthlyPlan.findMany({
    where: { userId: user.id },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: { id: true, year: true, month: true, title: true, _count: { select: { tasks: true } } },
  });

  // Default to the current month when a plan exists for it, otherwise the newest plan.
  const thisMonth = parseMonthKey(undefined);
  const hasCurrent = plans.some((p) => p.year === thisMonth.year && p.month === thisMonth.month);
  const current = selected
    ? parseMonthKey(selected)
    : hasCurrent || !plans[0]
      ? thisMonth
      : { year: plans[0].year, month: plans[0].month };
  const activePlan = plans.find((p) => p.year === current.year && p.month === current.month) ?? null;

  const tasks = activePlan
    ? await prisma.task.findMany({
        where: { planId: activePlan.id, assigneeId: user.id },
        include: taskListInclude,
        orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      })
    : [];

  const count = (s: string) => tasks.filter((t) => t.status === s).length;
  const progress = tasks.length ? Math.round(tasks.reduce((sum, t) => sum + t.completion, 0) / tasks.length) : 0;

  return (
    <>
      <PageHeader title={`Hello, ${user.name}`} description="Your monthly plans and assigned tasks. Open a task to update its status and progress." />

      {plans.length === 0 ? (
        <EmptyState icon={ListTodo} title="No plans yet" description="Your manager has not assigned any monthly tasks to you." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <div className="space-y-2">
            <p className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Monthly plans</p>
            {plans.map((p) => {
              const active = p.id === activePlan?.id;
              return (
                <Link
                  key={p.id}
                  href={`/my-tasks?month=${p.year}-${String(p.month).padStart(2, "0")}`}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent",
                    active && "border-primary/40 bg-primary/5 font-medium",
                  )}
                >
                  <span>
                    {MONTH_NAMES[p.month - 1]} {p.year}
                  </span>
                  <span className="text-xs text-muted-foreground">{p._count.tasks} tasks</span>
                </Link>
              );
            })}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ["Total", tasks.length, ""],
                ["Completed", count("COMPLETED"), "text-emerald-600 dark:text-emerald-400"],
                ["In progress", count("IN_PROGRESS"), "text-sky-600 dark:text-sky-400"],
                ["Overdue", count("OVERDUE"), "text-rose-600 dark:text-rose-400"],
                ["Progress", `${progress}%`, ""],
              ].map(([label, value, tone]) => (
                <div key={label} className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={cn("mt-1 text-xl font-semibold tabular-nums", tone as string)}>{value}</p>
                </div>
              ))}
            </div>

            {activePlan?.title && <p className="text-sm text-muted-foreground">{activePlan.title}</p>}

            {tasks.length === 0 ? (
              <EmptyState icon={ListTodo} title="No tasks this month" />
            ) : (
              <div className="grid gap-3">
                {tasks.map((task) => {
                  const done = task.subtasks.filter((s) => s.isCompleted).length;
                  return (
                    <Link key={task.id} href={`/my-tasks/${task.id}`}>
                      <Card className="transition-colors hover:bg-accent/40">
                        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 space-y-1">
                            <p className="truncate font-medium">{task.title}</p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>Due {formatDate(task.dueDate)}</span>
                              <CategoryBadge category={task.category} />
                              {task._count.subtasks > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <CheckSquare className="size-3" /> {done}/{task._count.subtasks}
                                </span>
                              )}
                              {task._count.comments > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <MessageSquare className="size-3" /> {task._count.comments}
                                </span>
                              )}
                              {task._count.attachments > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <Paperclip className="size-3" /> {task._count.attachments}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <PriorityBadge priority={task.priority} />
                            <StatusBadge status={task.status} />
                            <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{task.completion}%</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
