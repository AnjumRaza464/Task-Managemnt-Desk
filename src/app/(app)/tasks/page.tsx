import type { Metadata } from "next";
import Link from "next/link";
import { KanbanSquare } from "lucide-react";
import { requireManagerPage } from "@/lib/auth-guard";
import { getTaskFormOptions, getTasks, parseTaskFilters } from "@/lib/queries/tasks";
import { syncOverdueTasks } from "@/lib/overdue";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskTable } from "@/components/tasks/task-table";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  await requireManagerPage();
  await syncOverdueTasks();
  const filters = parseTaskFilters(await searchParams);
  const [result, options] = await Promise.all([getTasks(filters), getTaskFormOptions()]);

  return (
    <>
      <PageHeader title="All Tasks" description={`${result.total} task${result.total === 1 ? "" : "s"} across all monthly plans`}>
        <Button variant="outline" nativeButton={false} render={<Link href="/tasks/kanban" />}>
          <KanbanSquare /> Kanban
        </Button>
        <NewTaskButton options={options} />
      </PageHeader>
      <div className="flex flex-col gap-4">
        <TaskFilters options={options} />
        <TaskTable tasks={result.items} options={options} />
        <Pagination page={result.page} pageCount={result.pageCount} total={result.total} pageSize={result.pageSize} />
      </div>
    </>
  );
}
