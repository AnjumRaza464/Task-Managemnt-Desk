import type { Metadata } from "next";
import Link from "next/link";
import { ListTodo } from "lucide-react";
import { requireMemberPage } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { after } from "next/server";
import { syncOverdueTasks } from "@/lib/overdue";
import { monthRange } from "@/lib/dates";
import { getTaskFormOptions, taskListInclude } from "@/lib/queries/tasks";
import { getAssignableUsers } from "@/lib/queries/users";
import { MyTaskList } from "@/components/member/my-task-list";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { MONTH_NAMES } from "@/lib/constants";
import { cn, monthKey, parseMonthKey } from "@/lib/utils";

export const metadata: Metadata = { title: "My tasks" };

export default async function MyTasksPage({ searchParams }: PageProps<"/my-tasks">) {
  const user = await requireMemberPage();
  // Overdue sync runs after the response is sent so it never delays the page.
  after(() => syncOverdueTasks());
  const params = await searchParams;
  const selected = typeof params.month === "string" ? params.month : "";

  // Every task the user is assigned to (as primary or additional assignee), grouped by due month.
  const mine = { assignees: { some: { userId: user.id } } };
  const dueDates = await prisma.task.findMany({ where: mine, select: { dueDate: true } });
  const monthCounts = new Map<string, number>();
  for (const t of dueDates) {
    const key = monthKey(t.dueDate.getFullYear(), t.dueDate.getMonth() + 1);
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const months = [...monthCounts.entries()]
    .map(([key, count]) => ({ key, count, ...parseMonthKey(key) }))
    .sort((a, b) => b.year - a.year || b.month - a.month);

  // Default to the current month when it has tasks, otherwise the newest month.
  const thisMonth = parseMonthKey(undefined);
  const thisKey = monthKey(thisMonth.year, thisMonth.month);
  const current = selected ? parseMonthKey(selected) : monthCounts.has(thisKey) || months.length === 0 ? thisMonth : months[0];
  const currentKey = monthKey(current.year, current.month);

  // The task modal needs the people to @mention and, for managers, the form options for Edit.
  const [tasks, users, options] = await Promise.all([
    prisma.task.findMany({
      where: { ...mine, dueDate: monthRange(current.year, current.month) },
      include: taskListInclude,
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
    }),
    getAssignableUsers(),
    user.role === "MEMBER" ? Promise.resolve(null) : getTaskFormOptions(user),
  ]);

  const count = (s: string) => tasks.filter((t) => t.status === s).length;
  const progress = tasks.length ? Math.round(tasks.reduce((sum, t) => sum + t.completion, 0) / tasks.length) : 0;

  return (
    <>
      <PageHeader title={`Hello, ${user.name}`} description="Your assigned tasks by month. Open a task to update its status, progress and discussion." />

      {months.length === 0 ? (
        <EmptyState icon={ListTodo} title="No tasks yet" description="Nothing has been assigned to you so far." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <div className="space-y-2">
            <p className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Months</p>
            {months.map((m) => {
              const active = m.key === currentKey;
              return (
                <Link
                  key={m.key}
                  href={`/my-tasks?month=${m.key}`}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent",
                    active && "border-primary/40 bg-primary/5 font-medium",
                  )}
                >
                  <span>
                    {MONTH_NAMES[m.month - 1]} {m.year}
                  </span>
                  <span className="text-xs text-muted-foreground">{m.count} tasks</span>
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

            {tasks.length === 0 ? (
              <EmptyState icon={ListTodo} title="No tasks this month" />
            ) : (
              <MyTaskList tasks={tasks} currentUserId={user.id} users={users} options={options} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
