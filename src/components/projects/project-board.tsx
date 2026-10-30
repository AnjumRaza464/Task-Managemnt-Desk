"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  CheckSquare,
  Eye,
  Flag,
  FolderInput,
  Loader2,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createList, deleteList, moveTaskToList, renameList } from "@/actions/lists";
import { deleteTask, updateTaskStatus } from "@/actions/tasks";
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
import { Input } from "@/components/ui/input";
import { AssigneeAvatars } from "@/components/shared/assignee-avatars";
import { PriorityBadge, StatusBadge } from "@/components/shared/badges";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TaskFormDialog, taskToFormValues, type TaskFormValues } from "@/components/tasks/task-form-dialog";
import { STATUS_LABELS, TASK_STATUSES } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import type { ProjectTask } from "@/lib/queries/projects";
import type { TaskFormOptions } from "@/lib/queries/tasks";
import type { TaskStatus } from "@/generated/prisma/enums";

const DRAG_TYPE = "application/x-taskmanagement-project-task";
const UNSORTED = "__unsorted__";

type ListRow = { id: string; name: string; position: number };

export function ProjectBoard({
  projectId,
  lists,
  tasks: initial,
  options,
  access,
  currentUserId,
  taskHref,
}: {
  projectId: string;
  lists: ListRow[];
  tasks: ProjectTask[];
  options: TaskFormOptions;
  access: { canEdit: boolean; canManage: boolean };
  currentUserId: string;
  taskHref: string;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setTasks(initial);
  }

  const [dragId, setDragId] = useState<string | null>(null);
  const [overList, setOverList] = useState<string | null>(null);
  const [editing, setEditing] = useState<TaskFormValues | null>(null);
  const [creatingIn, setCreatingIn] = useState<string | null | false>(false);
  const [deleting, setDeleting] = useState<ProjectTask | null>(null);
  const [deletingList, setDeletingList] = useState<ListRow | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [, startTransition] = useTransition();
  const [listPending, startListTransition] = useTransition();

  const columns: { key: string; listId: string | null; name: string }[] = [
    ...lists.map((l) => ({ key: l.id, listId: l.id, name: l.name })),
  ];
  const unsorted = tasks.filter((t) => !t.listId || !lists.some((l) => l.id === t.listId));
  if (unsorted.length > 0 || lists.length === 0) columns.unshift({ key: UNSORTED, listId: null, name: "Unsorted" });

  function canMove(task: ProjectTask) {
    return access.canEdit || task.assignees.some((a) => a.userId === currentUserId);
  }

  function move(id: string, listId: string | null, index?: number) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const currentKey = task.listId && lists.some((l) => l.id === task.listId) ? task.listId : null;
    if (currentKey === listId && index === undefined) return;
    const snapshot = tasks;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, listId } : t)));
    startTransition(async () => {
      const result = await moveTaskToList({ id, listId, index });
      if (!result.ok) {
        setTasks(snapshot);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function changeStatus(task: ProjectTask, status: TaskStatus) {
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

  function addList(event: React.FormEvent) {
    event.preventDefault();
    const name = newListName.trim();
    if (!name) return;
    startListTransition(async () => {
      const result = await createList({ projectId, name });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setNewListName("");
      setAddingList(false);
      router.refresh();
    });
  }

  function saveRename() {
    if (!renaming) return;
    const name = renaming.name.trim();
    const current = lists.find((l) => l.id === renaming.id);
    if (!name || name === current?.name) {
      setRenaming(null);
      return;
    }
    startListTransition(async () => {
      const result = await renameList({ id: renaming.id, name });
      setRenaming(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
        {columns.map((col) => {
          const items = tasks.filter((t) => (col.listId === null ? !t.listId || !lists.some((l) => l.id === t.listId) : t.listId === col.listId));
          const isOver = overList === col.key && dragId !== null;
          const done = items.filter((t) => t.status === "COMPLETED").length;
          return (
            <section
              key={col.key}
              aria-label={`${col.name} list`}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors",
                isOver && "border-primary/50 bg-primary/5",
              )}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overList !== col.key) setOverList(col.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverList(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData(DRAG_TYPE) || dragId;
                setOverList(null);
                setDragId(null);
                if (id) move(id, col.listId);
              }}
            >
              <header className="flex items-center gap-2 px-3 py-2.5">
                {renaming?.id === col.listId ? (
                  <form
                    className="flex flex-1 items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveRename();
                    }}
                  >
                    <Input
                      value={renaming.name}
                      onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                      autoFocus
                      className="h-7"
                      maxLength={60}
                      onKeyDown={(e) => e.key === "Escape" && setRenaming(null)}
                    />
                    <Button type="submit" size="icon-xs" variant="ghost" aria-label="Save">
                      <Check />
                    </Button>
                    <Button type="button" size="icon-xs" variant="ghost" aria-label="Cancel" onClick={() => setRenaming(null)}>
                      <X />
                    </Button>
                  </form>
                ) : (
                  <>
                    <span className="truncate text-sm font-medium">{col.name}</span>
                    <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                      {done}/{items.length}
                    </span>
                    {access.canManage && col.listId && (
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label="List actions" />}>
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setCreatingIn(col.listId)}>
                            <Plus /> Add task here
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setRenaming({ id: col.listId!, name: col.name })}>
                            <Pencil /> Rename list
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeletingList(lists.find((l) => l.id === col.listId) ?? null)}
                          >
                            <Trash2 /> Delete list
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </>
                )}
              </header>

              <div className="flex max-h-[calc(100svh-20rem)] min-h-32 flex-1 flex-col gap-2 overflow-y-auto p-2 pt-0">
                {items.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
                    {dragId ? "Drop here" : "No tasks"}
                  </div>
                ) : (
                  items.map((task) => (
                    <BoardCard
                      key={task.id}
                      task={task}
                      href={`${taskHref}/${task.id}`}
                      lists={lists}
                      draggable={canMove(task)}
                      dragging={dragId === task.id}
                      canManage={access.canManage}
                      canSetStatus={access.canManage || task.assignees.some((a) => a.userId === currentUserId)}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_TYPE, task.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(task.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverList(null);
                      }}
                      onMove={(listId) => move(task.id, listId)}
                      onStatus={(s) => changeStatus(task, s)}
                      onEdit={() => setEditing(taskToFormValues(task))}
                      onDelete={() => setDeleting(task)}
                    />
                  ))
                )}
              </div>
              {access.canEdit && (
                <div className="p-2 pt-0">
                  <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => setCreatingIn(col.listId)}>
                    <Plus /> Add task
                  </Button>
                </div>
              )}
            </section>
          );
        })}

        {access.canManage && (
          <section className="flex w-72 shrink-0 flex-col">
            {addingList ? (
              <form onSubmit={addList} className="flex items-center gap-1 rounded-xl border bg-muted/40 p-2">
                <Input
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="List name"
                  autoFocus
                  maxLength={60}
                  className="h-8"
                  onKeyDown={(e) => e.key === "Escape" && setAddingList(false)}
                />
                <Button type="submit" size="sm" disabled={listPending || !newListName.trim()}>
                  {listPending ? <Loader2 className="animate-spin" /> : <Check />}
                </Button>
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel" onClick={() => setAddingList(false)}>
                  <X />
                </Button>
              </form>
            ) : (
              <Button variant="outline" className="justify-start border-dashed text-muted-foreground" onClick={() => setAddingList(true)}>
                <Plus /> Add list
              </Button>
            )}
          </section>
        )}
      </div>

      <TaskFormDialog
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        task={editing}
        options={options}
        lockProject
      />
      <TaskFormDialog
        open={creatingIn !== false}
        onOpenChange={(o) => !o && setCreatingIn(false)}
        options={options}
        defaults={{ projectId, listId: creatingIn || "" }}
        lockProject
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
      <ConfirmDialog
        open={Boolean(deletingList)}
        onOpenChange={(o) => !o && setDeletingList(null)}
        title="Delete this list?"
        description={`Tasks in "${deletingList?.name}" are kept and move to Unsorted.`}
        confirmLabel="Delete list"
        onConfirm={async () => {
          if (!deletingList) return;
          const result = await deleteList(deletingList.id);
          if (!result.ok) throw new Error(result.error);
          toast.success("List deleted");
          router.refresh();
        }}
      />
    </>
  );
}

function BoardCard({
  task,
  href,
  lists,
  draggable,
  dragging,
  canManage,
  canSetStatus,
  onDragStart,
  onDragEnd,
  onMove,
  onStatus,
  onEdit,
  onDelete,
}: {
  task: ProjectTask;
  href: string;
  lists: ListRow[];
  draggable: boolean;
  dragging: boolean;
  canManage: boolean;
  canSetStatus: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onMove: (listId: string | null) => void;
  onStatus: (status: TaskStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const done = task.subtasks.filter((s) => s.isCompleted).length;
  const overdue = task.status === "OVERDUE";
  const openBlockers = task.blockedBy.filter((b) => b.blocker.status !== "COMPLETED" && b.blocker.status !== "CANCELLED");

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "rounded-lg border bg-card p-3 shadow-xs transition-opacity",
        draggable && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-40",
        task.status === "COMPLETED" && "opacity-75",
      )}
    >
      <div className="flex items-start gap-1">
        <Link href={href} draggable={false} className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-snug hover:underline">
          {task.title}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" className="-mt-0.5 -mr-1 shrink-0" aria-label="Task actions" />}>
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem render={<Link href={href} />}>
              <Eye /> View details
            </DropdownMenuItem>
            {canManage && (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil /> Edit
              </DropdownMenuItem>
            )}
            {canSetStatus && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <CheckSquare /> Set status
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {TASK_STATUSES.map((s) => (
                    <DropdownMenuItem key={s} disabled={s === task.status} onClick={() => onStatus(s)}>
                      {STATUS_LABELS[s]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            {draggable && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderInput /> Move to list
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {lists.map((l) => (
                    <DropdownMenuItem key={l.id} disabled={l.id === task.listId} onClick={() => onMove(l.id)}>
                      {l.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem disabled={!task.listId} onClick={() => onMove(null)}>
                    Unsorted
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            {canManage && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={task.status} className="px-1.5 py-0 text-[10px]" />
        <PriorityBadge priority={task.priority} className="px-1.5 py-0 text-[10px]" />
        {task.milestone && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground" title={`Milestone: ${task.milestone.title}`}>
            <Flag className="size-3" /> {task.milestone.title}
          </span>
        )}
        {openBlockers.length > 0 && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-300"
            title={`Waiting on: ${openBlockers.map((b) => b.blocker.title).join(", ")}`}
          >
            <Lock className="size-3" /> Blocked
          </span>
        )}
      </div>

      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", task.status === "COMPLETED" ? "bg-emerald-500" : "bg-primary")} style={{ width: `${task.completion}%` }} />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <AssigneeAvatars assignees={task.assignees} size="xs" max={3} />
        <span className="flex shrink-0 items-center gap-2">
          {task._count.subtasks > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <CheckSquare className="size-3" /> {done}/{task._count.subtasks}
            </span>
          )}
          {task._count.comments > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <MessageSquare className="size-3" /> {task._count.comments}
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
