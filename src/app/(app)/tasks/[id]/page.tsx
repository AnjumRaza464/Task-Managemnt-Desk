import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarRange, FolderKanban, Repeat } from "lucide-react";
import { requireManagerPage } from "@/lib/auth-guard";
import { syncOverdueTasks } from "@/lib/overdue";
import { getTaskById, getTaskFormOptions } from "@/lib/queries/tasks";
import { MONTH_NAMES, RECURRENCE_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssigneeAvatars, assigneeLabel } from "@/components/shared/assignee-avatars";
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
  const [task, options] = await Promise.all([getTaskById(id), getTaskFormOptions(manager)]);
  if (!task) notFound();

  const monthLabel = `${MONTH_NAMES[task.plan.month - 1]} ${task.plan.year}`;
  const repeats = task.recurrence !== "NONE";
  const repeatLabel = repeats
    ? `${RECURRENCE_LABELS[task.recurrence]}${task.recurrenceEndsAt ? ` until ${formatDate(task.recurrenceEndsAt)}` : ""}`
    : "No";

  return (
    <>
      <PageHeader title={task.title} description={`${assigneeLabel(task.assignees)} · ${monthLabel} plan`}>
        <Button variant="outline" nativeButton={false} render={<Link href="/tasks" />}>
          <ArrowLeft /> All tasks
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href={`/monthly-plans/${task.plan.id}`} />}>
          <CalendarRange /> Open plan
        </Button>
        {task.project && (
          <Button variant="outline" nativeButton={false} render={<Link href={`/projects/${task.project.id}`} />}>
            <FolderKanban /> Open project
          </Button>
        )}
        <TaskDetailActions
          task={{
            id: task.id,
            title: task.title,
            description: task.description,
            assigneeId: task.assigneeId,
            assignees: task.assignees,
            categoryId: task.categoryId,
            projectId: task.projectId,
            listId: task.listId,
            milestoneId: task.milestoneId,
            priority: task.priority,
            status: task.status,
            completion: task.completion,
            startDate: task.startDate,
            dueDate: task.dueDate,
            recurrence: task.recurrence,
            recurrenceEndsAt: task.recurrenceEndsAt,
          }}
          options={options}
        />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        <CategoryBadge category={task.category} />
        <span className="text-xs text-muted-foreground">Due {formatDate(task.dueDate)}</span>
        <AssigneeAvatars assignees={task.assignees} size="sm" max={5} />
        {repeats && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Repeat className="size-3" /> {RECURRENCE_LABELS[task.recurrence]}
          </span>
        )}
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
          <CommentSection target={{ taskId: task.id }} comments={task.comments} currentUserId={manager.id} users={options.users} canModerate />
          <ActivityTimeline activity={task.activity} />
        </div>

        <div className="space-y-6">
          <TaskProgressCard
            task={{ id: task.id, status: task.status, completion: task.completion, assigneeIds: task.assignees.map((a) => a.userId) }}
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
              <Row label="Repeats">{repeatLabel}</Row>
              <Row label="Completed">{formatDate(task.completedAt)}</Row>
              <Row label="Plan">
                <Link href={`/monthly-plans/${task.plan.id}`} className="hover:underline">
                  {monthLabel}
                </Link>
              </Row>
              <Row label="Project">
                {task.project ? (
                  <Link href={`/projects/${task.project.id}`} className="inline-flex items-center gap-1.5 hover:underline">
                    <span className="size-2 rounded-full" style={{ backgroundColor: task.project.color }} />
                    {task.project.name}
                  </Link>
                ) : (
                  "—"
                )}
              </Row>
              {task.project && <Row label="List">{task.list?.name ?? "Unsorted"}</Row>}
              {task.milestone && (
                <Row label="Milestone">
                  <Link href={`/projects/${task.project?.id}?tab=milestones`} className="hover:underline">
                    {task.milestone.title}
                  </Link>
                </Row>
              )}
              <Row label="Assignees">
                <span className="flex flex-col items-end gap-1">
                  {task.assignees.map((a) => (
                    <Link key={a.userId} href={`/users/${a.user.id}`} className="hover:underline">
                      {a.user.name}
                      {a.userId === task.assigneeId && task.assignees.length > 1 && (
                        <span className="ml-1 text-xs text-muted-foreground">(primary)</span>
                      )}
                    </Link>
                  ))}
                </span>
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
