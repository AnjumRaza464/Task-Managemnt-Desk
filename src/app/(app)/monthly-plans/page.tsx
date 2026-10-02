import type { Metadata } from "next";
import { requireManagerPage } from "@/lib/auth-guard";
import { syncOverdueTasks } from "@/lib/overdue";
import { defaultDueDateInMonth } from "@/lib/dates";
import { getMonthOverview } from "@/lib/queries/plans";
import { getTaskFormOptions } from "@/lib/queries/tasks";
import { MONTH_NAMES } from "@/lib/constants";
import { cn, parseMonthKey, toDateInputValue } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { MonthPicker } from "@/components/plans/month-picker";
import { PlanOverview } from "@/components/plans/plan-overview";
import { NewTaskButton } from "@/components/tasks/new-task-button";

export const metadata: Metadata = { title: "Monthly Plans" };

export default async function MonthlyPlansPage({ searchParams }: PageProps<"/monthly-plans">) {
  await requireManagerPage();
  await syncOverdueTasks();
  const params = await searchParams;
  const { year, month } = parseMonthKey(typeof params.month === "string" ? params.month : undefined);

  const [rows, options] = await Promise.all([getMonthOverview(year, month), getTaskFormOptions()]);
  const withPlan = rows.filter((r) => r.plan).length;
  const totals = rows.reduce(
    (acc, r) => ({
      total: acc.total + r.stats.total,
      completed: acc.completed + r.stats.completed,
      inProgress: acc.inProgress + r.stats.inProgress,
      overdue: acc.overdue + r.stats.overdue,
    }),
    { total: 0, completed: 0, inProgress: 0, overdue: 0 },
  );
  const defaultDueDate = toDateInputValue(defaultDueDateInMonth(year, month));

  const summary = [
    ["Users with a plan", `${withPlan} / ${rows.length}`, ""],
    ["Tasks this month", totals.total, ""],
    ["Completed", totals.completed, "text-emerald-600 dark:text-emerald-400"],
    ["Overdue", totals.overdue, "text-rose-600 dark:text-rose-400"],
  ] as const;

  return (
    <>
      <PageHeader
        title="Monthly Plans"
        description={`${MONTH_NAMES[month - 1]} ${year} · one plan per user per month, tasks are placed by due date`}
      >
        <MonthPicker year={year} month={month} />
        <NewTaskButton options={options} defaults={{ dueDate: defaultDueDate }} />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summary.map(([label, value, tone]) => (
          <div key={label} className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("mt-1 text-xl font-semibold tabular-nums", tone)}>{value}</p>
          </div>
        ))}
      </div>

      <PlanOverview rows={rows} year={year} month={month} defaultDueDate={defaultDueDate} options={options} />
    </>
  );
}
