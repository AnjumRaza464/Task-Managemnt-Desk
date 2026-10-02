import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarRange } from "lucide-react";
import { requireManagerPage } from "@/lib/auth-guard";
import { syncOverdueTasks } from "@/lib/overdue";
import { getTaskById, getTaskFormOptions } from "@/lib/queries/tasks";
import { MONTH_NAMES } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryBadge, PriorityBadge, StatusBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { ActivityTimeline } from "@/components/tasks/activity-timeline";
import { AttachmentList } from "@/components/tasks/attachment-list";
import { CommentSection } from "@/components/tasks/comment-section";
import { SubtaskList } from "@/components/tasks/subtask-list";
import { TaskDetailActions } from "@/components/tasks/task-detail-actions";
import { TaskProgressCard } from "@/components/tasks/task-progress-card";

export const metadata: Metadata = { title: "Task" };

export default async function TaskDetailPage({ params }: PageProps<"/tasks/[id]">) {
  const manager = await requireManagerPage();
  await syncOverdueTasks();
  const { id } = await params;
  const [task, options] = await Promise.all([getTaskById(id), getTaskFormOptions()]);
  if (!task) notFound();

  const monthLabel = `${MONTH_NAMES[task.plan.month - 1]} ${task.plan.year}`;

  return (
    <>
      <PageHeader title={task.title} description={`${task.assignee.name} · ${monthLabel} plan`}>
        <Button variant="outline" nativeButton={false} render={<Link href="/tasks" />}>
          <ArrowLeft /> All tasks
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href={`/monthly-plans/${task.plan.id}`} />}>
          <CalendarRange /> Open plan
        </Button>
        <TaskDetailActions
          task={{
            id: task.id,
            title: task.title,
            description: task.description,
            assigneeId: task.assigneeId,
            categoryId: task.categoryId,
            priority: task.priority,
            status: task.status,
            completion: task.completion,
            startDate: task.startDate,
            dueDate: task.dueDate,
          }}
          options={options}
        />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        <CategoryBadge category={task.category} />
        <span className="text-xs text-muted-foreground">Due {formatDate(task.dueDate)}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.description || "No description provided."}</p>
            </CardContent>
          </Card>

          <SubtaskList taskId={task.id} subtasks={task.subtasks} />
          <CommentSection taskId={task.id} comments={task.comments} currentUserId={manager.id} />
          <ActivityTimeline activity={task.activity} />
        </div>

        <div className="space-y-6">
          <TaskProgressCard
            task={{ id: task.id, status: task.status, completion: task.completion, assigneeId: task.assigneeId }}
            options={options}
          />

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Priority">
                <PriorityBadge priority={task.priority} />
              </Row>
              <Row label="Category">
                <CategoryBadge category={task.category} />
              </Row>
              <Row label="Start date">{formatDate(task.startDate)}</Row>
              <Row label="Due date">{formatDate(task.dueDate)}</Row>
              <Row label="Completed">{formatDate(task.completedAt)}</Row>
              <Row label="Plan">
                <Link href={`/monthly-plans/${task.plan.id}`} className="hover:underline">
                  {monthLabel}
                </Link>
              </Row>
              <Row label="Assignee">
                <Link href={`/users/${task.assignee.id}`} className="hover:underline">
                  {task.assignee.name}
                </Link>
              </Row>
              <Row label="Created by">{task.createdBy.name}</Row>
              <Row label="Created">{formatDateTime(task.createdAt)}</Row>
              <Row label="Updated">{formatDateTime(task.updatedAt)}</Row>
            </CardContent>
          </Card>

          <AttachmentList taskId={task.id} attachments={task.attachments} />
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
