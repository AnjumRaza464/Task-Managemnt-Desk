import type { Metadata } from "next";
import { requireManagerPage } from "@/lib/auth-guard";
import { syncOverdueTasks } from "@/lib/overdue";
import { defaultDueDateInMonth } from "@/lib/dates";
import { getTaskFormOptions, getTasksForMonth, parseTaskFilters } from "@/lib/queries/tasks";
import { MONTH_NAMES } from "@/lib/constants";
import { parseMonthKey, toDateInputValue } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { MonthPicker } from "@/components/plans/month-picker";
import { MonthGrid } from "@/components/calendar/month-grid";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TaskFilters } from "@/components/tasks/task-filters";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  await requireManagerPage();
  await syncOverdueTasks();
  const params = await searchParams;
  const { year, month } = parseMonthKey(typeof params.month === "string" ? params.month : undefined);
  const filters = parseTaskFilters(params);

  const [tasks, options] = await Promise.all([
    getTasksForMonth(year, month, { q: filters.q, user: filters.user, status: filters.status, priority: filters.priority, category: filters.category }),
    getTaskFormOptions(),
  ]);
  const defaultDueDate = toDateInputValue(defaultDueDateInMonth(year, month));

  return (
    <>
      <PageHeader
        title="Calendar"
        description={`${tasks.length} task${tasks.length === 1 ? "" : "s"} due in ${MONTH_NAMES[month - 1]} ${year} · click a task to open it`}
      >
        <MonthPicker year={year} month={month} />
        <NewTaskButton options={options} defaults={{ dueDate: defaultDueDate }} />
      </PageHeader>
      <div className="flex flex-col gap-4">
        <TaskFilters options={options} showMonth={false} showDates={false} />
        <MonthGrid year={year} month={month} tasks={tasks} />
      </div>
    </>
  );
}
