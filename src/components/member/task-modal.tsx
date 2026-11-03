"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, Circle, ExternalLink, FileText, Flag, Loader2, Lock, MessageSquare, Paperclip, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { updateSubtask } from "@/actions/subtasks";
import { uploadAttachment } from "@/actions/attachments";
import { getTaskPanel, type TaskPanel } from "@/actions/task-view";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AssigneeAvatars } from "@/components/shared/assignee-avatars";
import { CategoryBadge, PriorityBadge, StatusBadge } from "@/components/shared/badges";
import { MyTaskControls } from "@/components/member/my-task-controls";
import { TaskConversation } from "@/components/member/task-conversation";
import { TimeTracker } from "@/components/member/time-tracker";
import type { MentionUser } from "@/components/tasks/mention-composer";
import { MAX_ATTACHMENT_BYTES } from "@/lib/constants";
import { cn, formatBytes, formatDate } from "@/lib/utils";

/**
 * Task details on the left (read-only for members, with their own
 * status/progress controls when assigned) and the chat / discussion on the
 * right, opened from any project view without leaving the page.
 */
export function TaskModal({
  taskId,
  onOpenChange,
  users,
  taskHref,
}: {
  taskId: string | null;
  onOpenChange: (open: boolean) => void;
  users: MentionUser[];
  taskHref: string;
}) {
  const router = useRouter();
  const [task, setTask] = useState<TaskPanel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pane, setPane] = useState<"details" | "chat">("details");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const [, startTransition] = useTransition();

  // Reset the panel whenever a different task is opened (state follows the prop, no effect needed).
  const [shownTaskId, setShownTaskId] = useState<string | null>(null);
  if (taskId !== shownTaskId) {
    setShownTaskId(taskId);
    setTask(null);
    setError(null);
    setPane("details");
  }

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    getTaskPanel(taskId).then((result) => {
      if (cancelled) return;
      if (result.ok) setTask(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  function reload() {
    if (!taskId) return;
    getTaskPanel(taskId).then((result) => {
      if (result.ok) setTask(result.data);
    });
    router.refresh();
  }

  function toggleSubtask(id: string, isCompleted: boolean) {
    setBusyId(id);
    startTransition(async () => {
      const result = await updateSubtask({ id, isCompleted });
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      reload();
    });
  }

  function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !taskId) return;
    if (f.size > MAX_ATTACHMENT_BYTES) {
      toast.error("File is larger than 5 MB.");
      e.target.value = "";
      return;
    }
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("file", f);
    startUpload(async () => {
      const result = await uploadAttachment(fd);
      e.target.value = "";
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Uploaded ${f.name}`);
      reload();
    });
  }

  const open = Boolean(taskId);
  const doneSubtasks = task?.subtasks.filter((s) => s.isCompleted).length ?? 0;
  const openBlockers = task?.blockedBy.filter((b) => b.status !== "COMPLETED" && b.status !== "CANCELLED") ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(92svh,56rem)] w-[calc(100%-1rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl"
      >
        <DialogTitle className="sr-only">{task?.title ?? "Task"}</DialogTitle>
        <DialogDescription className="sr-only">Task details and conversation</DialogDescription>

        {/* Mobile pane switch */}
        <div className="flex items-center gap-1 border-b p-2 lg:hidden">
          {(["details", "chat"] as const).map((p) => (
            <Button key={p} size="sm" variant={pane === p ? "secondary" : "ghost"} onClick={() => setPane(p)}>
              {p === "details" ? <FileText /> : <MessageSquare />} {p === "details" ? "Details" : "Chat & discussion"}
            </Button>
          ))}
          <Button size="icon-sm" variant="ghost" className="ml-auto" aria-label="Close" onClick={() => onOpenChange(false)}>
            <X />
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[1.15fr_minmax(22rem,30rem)]">
          {/* Details */}
          <div className={cn("min-h-0 overflow-y-auto p-5 sm:p-6", pane !== "details" && "hidden lg:block")}>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : !task ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading task…
              </p>
            ) : (
              <div className="space-y-6">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {task.project && (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="size-2 rounded-full" style={{ backgroundColor: task.project.color }} /> {task.project.name}
                        </span>
                      )}
                      {task.list && <span>· {task.list.name}</span>}
                      {task.milestone && (
                        <span className="inline-flex items-center gap-1">
                          · <Flag className="size-3" /> {task.milestone.title}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-semibold leading-tight">{task.title}</h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="hidden lg:inline-flex"
                    aria-label="Open full page"
                    title="Open full page"
                    nativeButton={false}
                    render={<Link href={`${taskHref}/${task.id}`} />}
                  >
                    <ExternalLink />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="hidden lg:inline-flex" aria-label="Close" onClick={() => onOpenChange(false)}>
                    <X />
                  </Button>
                </div>

                <section className="space-y-1.5">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Assignees</p>
                  {task.assignees.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nobody assigned yet</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {task.assignees.map((a) => (
                        <span key={a.userId} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs", a.userId === task.currentUserId && "border-primary/40 bg-primary/5")}>
                          <AssigneeAvatars assignees={[a]} size="xs" />
                          {a.userId === task.currentUserId ? "You" : a.user.name}
                        </span>
                      ))}
                    </div>
                  )}
                </section>

                <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Status">
                    <StatusBadge status={task.status} />
                  </Field>
                  <Field label="Priority">
                    <PriorityBadge priority={task.priority} />
                  </Field>
                  <Field label="Start">{formatDate(task.startDate, "MMM d, yyyy")}</Field>
                  <Field label="Due">
                    <span className={cn(task.status === "OVERDUE" && "font-medium text-rose-600 dark:text-rose-400")}>{formatDate(task.dueDate, "MMM d, yyyy")}</span>
                  </Field>
                  <Field label="Category">
                    <CategoryBadge category={task.category} />
                  </Field>
                  <Field label="Progress">{task.completion}%</Field>
                  <Field label="Created by">{task.createdBy.name}</Field>
                  <Field label="Completed">{formatDate(task.completedAt)}</Field>
                </section>

                {openBlockers.length > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                    <Lock className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      Waiting on {openBlockers.map((b) => `"${b.title}"`).join(", ")} before this can be completed.
                    </span>
                  </div>
                )}

                <section className="space-y-1.5">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Description</p>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.description || "No description provided."}</p>
                </section>

                {task.access.canUpdateProgress && task.access.isAssignee && (
                  <section className="rounded-xl border p-4">
                    <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Update your progress</p>
                    <MyTaskControls task={{ id: task.id, status: task.status, completion: task.completion }} />
                  </section>
                )}

                <section className="rounded-xl border p-4">
                  <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Time tracking</p>
                  <TimeTracker taskId={task.id} canTrack={task.access.canUpdateProgress} />
                </section>

                <section className="space-y-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Subtasks <span className="font-normal normal-case">{doneSubtasks}/{task.subtasks.length}</span>
                  </p>
                  {task.subtasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No subtasks.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {task.subtasks.map((s) => (
                        <li key={s.id} className="flex items-center gap-2 text-sm">
                          {task.access.canEdit ? (
                            busyId === s.id ? (
                              <Loader2 className="size-4 animate-spin text-muted-foreground" />
                            ) : (
                              <Checkbox checked={s.isCompleted} onCheckedChange={(c) => toggleSubtask(s.id, Boolean(c))} aria-label={s.title} />
                            )
                          ) : s.isCompleted ? (
                            <CheckCircle2 className="size-4 text-emerald-500" />
                          ) : (
                            <Circle className="size-4 text-muted-foreground" />
                          )}
                          <span className={cn(s.isCompleted && "text-muted-foreground line-through")}>{s.title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Files <span className="font-normal">{task.attachments.length}</span>
                    </p>
                    {task.access.canEdit && (
                      <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-primary hover:underline">
                        {uploading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />} Upload
                        <input type="file" className="hidden" onChange={upload} disabled={uploading} />
                      </label>
                    )}
                  </div>
                  {task.attachments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No files yet. Files sent in the chat show up here too.</p>
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {task.attachments.map((a) => (
                        <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                          <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                          <a href={`/api/attachments/${a.id}`} className="min-w-0 flex-1 truncate hover:underline" target="_blank" rel="noreferrer">
                            {a.fileName}
                          </a>
                          <span className="text-xs text-muted-foreground">{formatBytes(a.size)}</span>
                          <span className="hidden text-xs text-muted-foreground sm:inline">{a.uploadedBy.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="size-3" /> Created {formatDate(task.createdAt)} · updated {formatDate(task.updatedAt)}
                </p>
              </div>
            )}
          </div>

          {/* Conversation */}
          <div className={cn("min-h-0 border-t bg-muted/20 lg:border-t-0 lg:border-l", pane !== "chat" && "hidden lg:flex lg:flex-col", pane === "chat" && "flex flex-col")}>
            {taskId && task && (
              <TaskConversation taskId={taskId} currentUserId={task.currentUserId} users={users} canPost={task.access.canComment} className="h-full" />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}
