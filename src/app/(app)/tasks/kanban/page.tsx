import type { Metadata } from "next";
import Link from "next/link";
import { List } from "lucide-react";
import { requireManagerPage } from "@/lib/auth-guard";
import { syncOverdueTasks } from "@/lib/overdue";
import { getAllTasks, getTaskFormOptions, parseTaskFilters } from "@/lib/queries/tasks";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TaskFilters } from "@/components/tasks/task-filters";

export const metadata: Metadata = { title: "Kanban" };

export default async function KanbanPage({ searchParams }: PageProps<"/tasks/kanban">) {
  await requireManagerPage();
  await syncOverdueTasks();
  const filters = parseTaskFilters(await searchParams);
  const [tasks, options] = await Promise.all([getAllTasks(filters), getTaskFormOptions()]);

  return (
    <>
      <PageHeader
        title="Kanban Board"
        description={`${tasks.length} task${tasks.length === 1 ? "" : "s"} · drag a card to another column to change its status`}
      >
        <Button variant="outline" nativeButton={false} render={<Link href="/tasks" />}>
          <List /> List view
        </Button>
        <NewTaskButton options={options} />
      </PageHeader>
      <div className="flex flex-col gap-4">
        <TaskFilters options={options} />
        <KanbanBoard tasks={tasks} options={options} />
      </div>
    </>
  );
}
