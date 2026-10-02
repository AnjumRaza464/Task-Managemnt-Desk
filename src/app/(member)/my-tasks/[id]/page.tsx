import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle, Download, Paperclip } from "lucide-react";
import { requireMemberPage } from "@/lib/auth-guard";
import { getTaskById } from "@/lib/queries/tasks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryBadge, PriorityBadge, StatusBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { MyTaskControls } from "@/components/member/my-task-controls";
import { MONTH_NAMES } from "@/lib/constants";
import { cn, formatBytes, formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Task" };

export default async function MemberTaskPage({ params }: PageProps<"/my-tasks/[id]">) {
  const user = await requireMemberPage();
  const { id } = await params;
  const task = await getTaskById(id);
  // Members can only open tasks assigned to them.
  if (!task || task.assigneeId !== user.id) notFound();

  const doneSubtasks = task.subtasks.filter((s) => s.isCompleted).length;

  return (
    <>
      <PageHeader
        title={task.title}
        description={`${MONTH_NAMES[task.plan.month - 1]} ${task.plan.year} plan · you can update the status and progress below`}
      >
        <Button variant="outline" nativeButton={false} render={<Link href="/my-tasks" />}>
          <ArrowLeft /> Back to my tasks
        </Button>
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

          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent>
              {task.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                <ul className="space-y-4">
                  {task.comments.map((c) => (
                    <li key={c.id} className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{c.author.name}</span> · {formatDateTime(c.createdAt)}
                      </p>
                      <p className="whitespace-pre-wrap text-sm">{c.content}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
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
              <Row label="Start date">{formatDate(task.startDate)}</Row>
              <Row label="Due date">{formatDate(task.dueDate)}</Row>
              <Row label="Completed">{formatDate(task.completedAt)}</Row>
              <Row label="Created by">{task.createdBy.name}</Row>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Update progress</CardTitle>
            </CardHeader>
            <CardContent>
              <MyTaskControls task={{ id: task.id, status: task.status, completion: task.completion }} />
            </CardContent>
          </Card>

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
