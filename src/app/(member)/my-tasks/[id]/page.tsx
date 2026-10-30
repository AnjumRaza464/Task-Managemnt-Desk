import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle, Download, FolderKanban, Paperclip } from "lucide-react";
import { requireMemberPage } from "@/lib/auth-guard";
import { getDependencyCandidates, getTaskById, getTaskFormOptions } from "@/lib/queries/tasks";
import { getTaskAccess } from "@/lib/permissions";
import { getAssignableUsers } from "@/lib/queries/users";
import { AttachmentList } from "@/components/tasks/attachment-list";
import { CommentSection } from "@/components/tasks/comment-section";
import { SubtaskList } from "@/components/tasks/subtask-list";
import { TaskDetailActions } from "@/components/tasks/task-detail-actions";
import { DependencyCard } from "@/components/tasks/dependency-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryBadge, PriorityBadge, StatusBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { MyTaskControls } from "@/components/member/my-task-controls";
import { MONTH_NAMES, RECURRENCE_LABELS } from "@/lib/constants";
import { cn, formatBytes, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Task" };

export default async function MemberTaskPage({ params }: PageProps<"/my-tasks/[id]">) {
  const user = await requireMemberPage();
  const { id } = await params;
  const [task, users] = await Promise.all([getTaskById(id), getAssignableUsers()]);
  // Members open tasks assigned to them or in a project they belong to.
  if (!task) notFound();
  const access = await getTaskAccess(user, task);
  if (!access.canView) notFound();
  const options = access.canManage ? await getTaskFormOptions(user) : null;
  const candidates = task.projectId ? await getDependencyCandidates(task) : [];

  const doneSubtasks = task.subtasks.filter((s) => s.isCompleted).length;
  const repeatLabel =
    task.recurrence !== "NONE"
      ? `${RECURRENCE_LABELS[task.recurrence]}${task.recurrenceEndsAt ? ` until ${formatDate(task.recurrenceEndsAt)}` : ""}`
      : null;

  return (
    <>
      <PageHeader
        title={task.title}
        description={
          access.isAssignee
            ? `${MONTH_NAMES[task.plan.month - 1]} ${task.plan.year} plan · you can update the status and progress below`
            : `${task.assignees.map((a) => a.user.name).join(", ")} · ${task.project?.name ?? "no project"}`
        }
      >
        <Button variant="outline" nativeButton={false} render={<Link href="/my-tasks" />}>
          <ArrowLeft /> Back to my tasks
        </Button>
        {task.project && (
          <Button variant="outline" nativeButton={false} render={<Link href={`/my-projects/${task.project.id}`} />}>
            <FolderKanban /> {task.project.name}
          </Button>
        )}
        {access.canManage && options && (
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
            afterDeleteHref={task.project ? `/my-projects/${task.project.id}` : "/my-tasks"}
          />
        )}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.description || "No description provided."}</p>
            </CardContent>
          </Card>

          {access.canEdit ? (
            <SubtaskList taskId={task.id} subtasks={task.subtasks} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>
                  Subtasks{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {doneSubtasks}/{task.subtasks.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {task.subtasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No subtasks.</p>
                ) : (
                  <ul className="space-y-2">
                    {task.subtasks.map((s) => (
                      <li key={s.id} className="flex items-center gap-2 text-sm">
                        {s.isCompleted ? (
                          <CheckCircle2 className="size-4 text-emerald-500" />
                        ) : (
                          <Circle className="size-4 text-muted-foreground" />
                        )}
                        <span className={cn(s.isCompleted && "text-muted-foreground line-through")}>{s.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          <CommentSection
            target={{ taskId: task.id }}
            comments={task.comments}
            currentUserId={user.id}
            users={users}
            canComment={access.canComment}
            canModerate={access.canManage}
            description="Questions, updates and feedback stay with the task. Use @ to mention someone."
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Status">
                <StatusBadge status={task.status} />
              </Row>
              <Row label="Priority">
                <PriorityBadge priority={task.priority} />
              </Row>
              <Row label="Category">
                <CategoryBadge category={task.category} />
              </Row>
              {task.project && (
                <Row label="Project">
                  <Link href={`/my-projects/${task.project.id}`} className="hover:underline">
                    {task.project.name}
                  </Link>
                </Row>
              )}
              {task.project && <Row label="List">{task.list?.name ?? "Unsorted"}</Row>}
              {task.milestone && <Row label="Milestone">{task.milestone.title}</Row>}
              <Row label="Start date">{formatDate(task.startDate)}</Row>
              <Row label="Due date">{formatDate(task.dueDate)}</Row>
              {repeatLabel && <Row label="Repeats">{repeatLabel}</Row>}
              <Row label="Completed">{formatDate(task.completedAt)}</Row>
              <Row label="Assigned to">
                <span className="flex flex-col items-end">
                  {task.assignees.map((a) => (
                    <span key={a.userId}>{a.userId === user.id ? "You" : a.user.name}</span>
                  ))}
                </span>
              </Row>
              <Row label="Created by">{task.createdBy.name}</Row>
            </CardContent>
          </Card>

          {access.canUpdateProgress && (
            <Card>
              <CardHeader>
                <CardTitle>Update progress</CardTitle>
              </CardHeader>
              <CardContent>
                <MyTaskControls task={{ id: task.id, status: task.status, completion: task.completion }} />
              </CardContent>
            </Card>
          )}

          {(task.blockedBy.length > 0 || task.blocks.length > 0 || task.projectId) && (
            <DependencyCard
              taskId={task.id}
              blockedBy={task.blockedBy.map((d) => d.blocker)}
              blocks={task.blocks.map((d) => d.blocked)}
              candidates={candidates}
              canEdit={access.canEdit && Boolean(task.projectId)}
              taskHref="/my-tasks"
            />
          )}

          {access.canEdit ? (
            <AttachmentList taskId={task.id} attachments={task.attachments} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Attachments</CardTitle>
              </CardHeader>
              <CardContent>
                {task.attachments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No attachments.</p>
                ) : (
                  <ul className="space-y-2">
                    {task.attachments.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 text-sm">
                        <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                        <a href={`/api/attachments/${a.id}`} className="min-w-0 flex-1 truncate hover:underline" download>
                          {a.fileName}
                        </a>
                        <span className="text-xs text-muted-foreground">{formatBytes(a.size)}</span>
                        <a href={`/api/attachments/${a.id}`} aria-label="Download" className="text-muted-foreground hover:text-foreground" download>
                          <Download className="size-4" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
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
