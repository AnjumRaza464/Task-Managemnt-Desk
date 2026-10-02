"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckSquare,
  Eye,
  ListTodo,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Trash2,
  UserRoundCog,
} from "lucide-react";
import { toast } from "sonner";
import { deleteTask, reassignTask, updateTaskStatus } from "@/actions/tasks";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CategoryBadge, PriorityBadge, StatusBadge } from "@/components/shared/badges";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { TaskFormDialog, taskToFormValues, type TaskFormValues } from "@/components/tasks/task-form-dialog";
import { useQueryState } from "@/hooks/use-query-state";
import { STATUS_LABELS, TASK_STATUSES } from "@/lib/constants";
import { cn, formatDate, getInitials } from "@/lib/utils";
import type { TaskFormOptions, TaskListItem } from "@/lib/queries/tasks";

type SortKey = "title" | "assignee" | "priority" | "status" | "dueDate" | "completion";

function Head({
  label,
  sortKey,
  className,
  sortable,
}: {
  label: string;
  sortKey: SortKey;
  className?: string;
  sortable: boolean;
}) {
  return sortable ? (
    <SortHeader label={label} sortKey={sortKey} className={className} />
  ) : (
    <TableHead className={className}>{label}</TableHead>
  );
}

function SortHeader({ label, sortKey, className }: { label: string; sortKey: SortKey; className?: string }) {
  const { get, set } = useQueryState();
  const active = get("sort") === sortKey;
  const dir = get("dir") === "desc" ? "desc" : "asc";
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}
        onClick={() => set({ sort: sortKey, dir: active && dir === "asc" ? "desc" : "asc" }, { resetPage: false })}
      >
        {label}
        <Icon className="size-3.5" />
      </button>
    </TableHead>
  );
}

export function TaskTable({
  tasks,
  options,
  showAssignee = true,
  sortable = true,
  emptyTitle = "No tasks found",
  emptyDescription = "Try adjusting your filters or create a new task.",
}: {
  tasks: TaskListItem[];
  options: TaskFormOptions;
  showAssignee?: boolean;
  sortable?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<TaskFormValues | null>(null);
  const [deleting, setDeleting] = useState<TaskListItem | null>(null);
  const [, startTransition] = useTransition();

  function changeStatus(task: TaskListItem, status: TaskListItem["status"]) {
    startTransition(async () => {
      const result = await updateTaskStatus({ id: task.id, status });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Status set to ${STATUS_LABELS[result.data.status]}`);
      router.refresh();
    });
  }

  function reassign(task: TaskListItem, assigneeId: string) {
    startTransition(async () => {
      const result = await reassignTask({ id: task.id, assigneeId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Task reassigned");
      router.refresh();
    });
  }

  if (tasks.length === 0) {
    return <EmptyState icon={ListTodo} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <Head label="Task" sortKey="title" sortable={sortable} />
              {showAssignee && <Head label="Assignee" sortKey="assignee" className="hidden md:table-cell" sortable={sortable} />}
              <TableHead className="hidden xl:table-cell">Category</TableHead>
              <Head label="Priority" sortKey="priority" className="hidden sm:table-cell" sortable={sortable} />
              <Head label="Status" sortKey="status" sortable={sortable} />
              <Head label="Due" sortKey="dueDate" className="hidden lg:table-cell" sortable={sortable} />
              <Head label="Progress" sortKey="completion" className="hidden lg:table-cell" sortable={sortable} />
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const doneSubtasks = task.subtasks.filter((s) => s.isCompleted).length;
              return (
                <TableRow key={task.id}>
                  <TableCell className="max-w-[18rem]">
                    <Link href={`/tasks/${task.id}`} className="block truncate font-medium hover:underline">
                      {task.title}
                    </Link>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      {task._count.subtasks > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <CheckSquare className="size-3" /> {doneSubtasks}/{task._count.subtasks}
                        </span>
                      )}
                      {task._count.comments > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="size-3" /> {task._count.comments}
                        </span>
                      )}
                      {task._count.attachments > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Paperclip className="size-3" /> {task._count.attachments}
                        </span>
                      )}
                      <span className="lg:hidden">Due {formatDate(task.dueDate, "MMM d")}</span>
                    </div>
                  </TableCell>
                  {showAssignee && (
                    <TableCell className="hidden md:table-cell">
                      <Link href={`/users/${task.assignee.id}`} className="flex items-center gap-2 hover:underline">
                        <Avatar className="size-7">
                          <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                            {getInitials(task.assignee.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate text-sm">{task.assignee.name}</span>
                      </Link>
                    </TableCell>
                  )}
                  <TableCell className="hidden xl:table-cell">
                    <CategoryBadge category={task.category} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <PriorityBadge priority={task.priority} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={task.status} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(task.dueDate)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full", task.status === "COMPLETED" ? "bg-emerald-500" : "bg-primary")}
                          style={{ width: `${task.completion}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">{task.completion}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Task actions" />}>
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-44">
                        <DropdownMenuItem render={<Link href={`/tasks/${task.id}`} />}>
                          <Eye /> View details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditing(taskToFormValues(task))}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <CheckSquare /> Set status
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {TASK_STATUSES.map((s) => (
                              <DropdownMenuItem key={s} disabled={s === task.status} onClick={() => changeStatus(task, s)}>
                                {STATUS_LABELS[s]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <UserRoundCog /> Reassign
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                            {options.users.map((u) => (
                              <DropdownMenuItem key={u.id} disabled={u.id === task.assigneeId} onClick={() => reassign(task, u.id)}>
                                {u.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => setDeleting(task)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <TaskFormDialog
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        task={editing}
        options={options}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this task?"
        description={`"${deleting?.title}" and all of its subtasks, comments and attachments will be permanently removed.`}
        confirmLabel="Delete task"
        onConfirm={async () => {
          if (!deleting) return;
          const result = await deleteTask(deleting.id);
          if (!result.ok) throw new Error(result.error);
          toast.success("Task deleted");
          router.refresh();
        }}
      />
    </>
  );
}
