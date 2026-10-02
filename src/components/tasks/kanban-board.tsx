"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckSquare, Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTask, updateTaskStatus } from "@/actions/tasks";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CategoryBadge, PriorityBadge } from "@/components/shared/badges";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TaskFormDialog, taskToFormValues, type TaskFormValues } from "@/components/tasks/task-form-dialog";
import { STATUS_COLORS, STATUS_LABELS, TASK_STATUSES } from "@/lib/constants";
import { cn, formatDate, getInitials } from "@/lib/utils";
import type { TaskFormOptions, TaskListItem } from "@/lib/queries/tasks";
import type { TaskStatus } from "@/generated/prisma/enums";

const DRAG_TYPE = "application/x-taskmanagement-task";

export function KanbanBoard({ tasks: initial, options }: { tasks: TaskListItem[]; options: TaskFormOptions }) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  // Adopt fresh server data after router.refresh() without an effect.
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setTasks(initial);
  }

  const [dragId, setDragId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);
  const [editing, setEditing] = useState<TaskFormValues | null>(null);
  const [deleting, setDeleting] = useState<TaskListItem | null>(null);
  const [, startTransition] = useTransition();

  function moveTask(id: string, status: TaskStatus) {
    const task = tasks.find((t) => t.id === id);
    if (!task || task.status === status) return;
    const snapshot = tasks;
    // Optimistic move; the server may normalise the status (e.g. past due -> Overdue).
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    startTransition(async () => {
      const result = await updateTaskStatus({ id, status });
      if (!result.ok) {
        setTasks(snapshot);
        toast.error(result.error);
        return;
      }
      const { status: finalStatus, completion } = result.data;
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: finalStatus, completion } : t)));
      if (finalStatus !== status) {
        toast.info(`"${task.title}" is past its due date, so it was placed in ${STATUS_LABELS[finalStatus]}.`);
      } else {
        toast.success(`Moved to ${STATUS_LABELS[finalStatus]}`);
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
        {TASK_STATUSES.map((status) => {
          const items = tasks.filter((t) => t.status === status);
          const isOver = overStatus === status && dragId !== null;
          return (
            <section
              key={status}
              aria-label={`${STATUS_LABELS[status]} column`}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors",
                isOver && "border-primary/50 bg-primary/5",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overStatus !== status) setOverStatus(status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverStatus(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData(DRAG_TYPE) || dragId;
                setOverStatus(null);
                setDragId(null);
                if (id) moveTask(id, status);
              }}
            >
              <header className="flex items-center gap-2 px-3 py-2.5">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
                <span className="text-sm font-medium">{STATUS_LABELS[status]}</span>
                <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                  {items.length}
                </span>
              </header>
              <div className="flex max-h-[calc(100svh-16rem)] min-h-40 flex-1 flex-col gap-2 overflow-y-auto p-2 pt-0">
                {items.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
                    {dragId ? "Drop here" : "No tasks"}
                  </div>
                ) : (
                  items.map((task) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      dragging={dragId === task.id}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_TYPE, task.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(task.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStatus(null);
                      }}
                      onEdit={() => setEditing(taskToFormValues(task))}
                      onDelete={() => setDeleting(task)}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
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
          setTasks((prev) => prev.filter((t) => t.id !== deleting.id));
          toast.success("Task deleted");
          router.refresh();
        }}
      />
    </>
  );
}

function KanbanCard({
  task,
  dragging,
  onDragStart,
  onDragEnd,
  onEdit,
  onDelete,
}: {
  task: TaskListItem;
  dragging: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const done = task.subtasks.filter((s) => s.isCompleted).length;
  const overdue = task.status === "OVERDUE";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "cursor-grab rounded-lg border bg-card p-3 shadow-xs transition-opacity active:cursor-grabbing",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-1">
        <Link
          href={`/tasks/${task.id}`}
          draggable={false}
          className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-snug hover:underline"
        >
          {task.title}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-xs" className="-mt-0.5 -mr-1 shrink-0" aria-label="Task actions" />}
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            <DropdownMenuItem render={<Link href={`/tasks/${task.id}`} />}>
              <Eye /> View details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} className="px-1.5 py-0 text-[10px]" />
        <CategoryBadge category={task.category} />
      </div>

      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", task.status === "COMPLETED" ? "bg-emerald-500" : "bg-primary")}
          style={{ width: `${task.completion}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5">
          <Avatar className="size-5">
            <AvatarFallback className="bg-primary/10 text-[9px] text-primary">{getInitials(task.assignee.name)}</AvatarFallback>
          </Avatar>
          <span className="truncate">{task.assignee.name}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {task._count.subtasks > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <CheckSquare className="size-3" /> {done}/{task._count.subtasks}
            </span>
          )}
          <span className={cn("inline-flex items-center gap-0.5", overdue && "font-medium text-rose-600 dark:text-rose-400")}>
            <CalendarDays className="size-3" /> {formatDate(task.dueDate, "MMM d")}
          </span>
        </span>
      </div>
    </div>
  );
}
