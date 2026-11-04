"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { moveTaskToList } from "@/actions/lists";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarDays, FolderInput, GanttChart, GripVertical, KanbanSquare, LayoutList, Lock, MessagesSquare, MoreHorizontal, PieChart, Plus, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AssigneeAvatars } from "@/components/shared/assignee-avatars";
import { PriorityBadge, StatusBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { SelectField } from "@/components/shared/select-field";
import { ProjectCalendar } from "@/components/member/project-calendar";
import { TaskModal } from "@/components/member/task-modal";
import { ProjectHeaderActions } from "@/components/projects/project-header-actions";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { ProjectTimeline } from "@/components/projects/project-timeline";
import { CommentSection } from "@/components/tasks/comment-section";
import type { MentionUser } from "@/components/tasks/mention-composer";
import { useQueryState } from "@/hooks/use-query-state";
import { PRIORITY_COLORS, STATUS_COLORS, STATUS_LABELS, TASK_STATUSES } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import type { ProjectDetail, ProjectTask } from "@/lib/queries/projects";
import type { TaskFormOptions } from "@/lib/queries/tasks";
import { toDateInputValue } from "@/lib/utils";

type View = "board" | "list" | "timeline" | "calendar" | "overview" | "discussions";

const VIEWS: { key: View; label: string; icon: LucideIcon }[] = [
  { key: "board", label: "Board", icon: KanbanSquare },
  { key: "list", label: "List", icon: LayoutList },
  { key: "timeline", label: "Timeline", icon: GanttChart },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "overview", label: "Overview", icon: PieChart },
  { key: "discussions", label: "Discussions", icon: MessagesSquare },
];

/**
 * The member's project workspace: Board / List / Timeline / Calendar /
 * Overview, with task search and an assignee filter. Tasks
 * open in a modal with the chat on the right; members only view them.
 */
export function MemberProjectView({
  data,
  currentUserId,
  users,
  options = null,
}: {
  data: ProjectDetail;
  currentUserId: string;
  users: MentionUser[];
  /** Task form options; present when the viewer may create / edit tasks here. */
  options?: TaskFormOptions | null;
}) {
  const { project, access, stats } = data;
  const [creatingIn, setCreatingIn] = useState<string | null | false>(false);
  const manage = Boolean(options && access.canManage);
  const { get, set } = useQueryState();
  const view = (VIEWS.some((v) => v.key === get("tab")) ? get("tab") : "board") as View;
  const [query, setQuery] = useState("");
  const [who, setWho] = useState("");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Local copy of the tasks so a drag shows instantly; fresh server data replaces it after refresh.
  const [allTasks, setAllTasks] = useState(project.tasks);
  const [prevTasks, setPrevTasks] = useState(project.tasks);
  if (project.tasks !== prevTasks) {
    setPrevTasks(project.tasks);
    setAllTasks(project.tasks);
  }
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  // Project members may move any task between lists; an assignee may move their own.
  const canMove = (t: ProjectTask) => access.canEdit || t.assignees.some((a) => a.userId === currentUserId);

  function move(id: string, listId: string | null) {
    const task = allTasks.find((t) => t.id === id);
    if (!task || (task.listId ?? null) === listId) return;
    const snapshot = allTasks;
    const target = project.lists.find((l) => l.id === listId);
    setAllTasks((prev) => prev.map((t) => (t.id === id ? { ...t, listId, list: target ? { id: target.id, name: target.name } : null } : t)));
    startTransition(async () => {
      const result = await moveTaskToList({ id, listId });
      if (!result.ok) {
        setAllTasks(snapshot);
        toast.error(result.error);
        return;
      }
      toast.success(`Moved to ${target?.name ?? "Unsorted"}`);
      router.refresh();
    });
  }

  const tasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allTasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q) && !(t.description ?? "").toLowerCase().includes(q)) return false;
      if (who === "me" && !t.assignees.some((a) => a.userId === currentUserId)) return false;
      if (who && who !== "me" && !t.assignees.some((a) => a.userId === who)) return false;
      return true;
    });
  }, [allTasks, query, who, currentUserId]);

  const people = project.members.map((m) => ({ value: m.userId, label: m.userId === currentUserId ? "Me" : m.user.name }));
  const columns = [
    ...project.lists.map((l) => ({ key: l.id, name: l.name, items: tasks.filter((t) => t.listId === l.id) })),
  ];
  const unsorted = tasks.filter((t) => !t.listId || !project.lists.some((l) => l.id === t.listId));
  if (unsorted.length > 0) columns.unshift({ key: "unsorted", name: "Unsorted", items: unsorted });

  return (
    <>
      {/* Header: name, view switcher, search, people filter */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-sm" style={{ backgroundColor: project.color }} />
              <h2 className="truncate text-2xl font-semibold tracking-tight">{project.name}</h2>
              <ProjectStatusBadge status={project.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {project.workspace.name}
              {project.description ? ` · ${project.description}` : ""}
              {(project.startDate || project.dueDate) && ` · ${formatDate(project.startDate, "MMM d")} → ${formatDate(project.dueDate, "MMM d, yyyy")}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AssigneeAvatars assignees={project.members.map((m) => ({ user: m.user }))} size="sm" max={6} showNames />
            {manage && options && (
              <>
                <ProjectHeaderActions
                  project={{
                    id: project.id,
                    workspaceId: project.workspaceId,
                    name: project.name,
                    description: project.description ?? "",
                    color: project.color,
                    status: project.status,
                    startDate: toDateInputValue(project.startDate),
                    dueDate: toDateInputValue(project.dueDate),
                    memberIds: project.members.map((m) => m.userId),
                    taskCount: project.tasks.length,
                  }}
                  workspaces={[{ id: project.workspace.id, name: project.workspace.name, color: project.workspace.color }]}
                  users={users}
                  options={options}
                  canEdit={false}
                  canManage
                  canDelete={access.isGlobalManager}
                  backHref="/my-projects"
                />
                <Button onClick={() => setCreatingIn(project.lists[0]?.id ?? null)}>
                  <Plus /> New task
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap rounded-lg border bg-muted/40 p-0.5">
            {VIEWS.map((v) => {
              const active = v.key === view;
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => set({ tab: v.key === "board" ? null : v.key }, { resetPage: false })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                    active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <v.icon className="size-4" /> {v.label}
                </button>
              );
            })}
          </div>
          <div className="relative ml-auto w-full sm:w-60">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks" className="pl-8" aria-label="Search tasks" />
          </div>
          <SelectField value={who} onChange={setWho} placeholder="Everyone" className="w-full sm:w-40" options={[{ value: "", label: "Everyone" }, ...people].filter((o) => o.value)} />
        </div>
      </div>

      {view === "board" && (
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
          {columns.map((col) => {
            const listId = col.key === "unsorted" ? null : col.key;
            const isOver = overCol === col.key && dragId !== null;
            return (
              <section
                key={col.key}
                className={cn("flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors", isOver && "border-primary/50 bg-primary/5")}
                aria-label={`${col.name} list`}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overCol !== col.key) setOverCol(col.key);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverCol(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || dragId;
                  setOverCol(null);
                  setDragId(null);
                  if (id) move(id, listId);
                }}
              >
                <header className="flex items-center gap-2 px-3 py-2.5">
                  <span className="truncate text-sm font-medium">{col.name}</span>
                  <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{col.items.length}</span>
                </header>
                <div className="flex max-h-[calc(100svh-22rem)] min-h-24 flex-col gap-2 overflow-y-auto p-2 pt-0">
                  {col.items.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
                      {dragId ? "Drop here" : "No tasks"}
                    </div>
                  ) : (
                    col.items.map((t) => (
                      <BoardCard
                        key={t.id}
                        task={t}
                        lists={project.lists}
                        draggable={canMove(t)}
                        dragging={dragId === t.id}
                        onOpen={() => setOpenTaskId(t.id)}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", t.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDragId(t.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverCol(null);
                        }}
                        onMove={(to) => move(t.id, to)}
                      />
                    ))
                  )}
                </div>
                {manage && (
                  <div className="p-2 pt-0">
                    <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => setCreatingIn(listId)}>
                      <Plus /> Add task
                    </Button>
                  </div>
                )}
              </section>
            );
          })}
          {columns.length === 0 && <EmptyState title="No lists in this project" className="w-full" />}
        </div>
      )}

      {view === "list" &&
        (tasks.length === 0 ? (
          <EmptyState title="No tasks match" description="Try another search or clear the people filter." />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Priority</TableHead>
                  <TableHead className="hidden md:table-cell">Assignee</TableHead>
                  <TableHead className="hidden lg:table-cell">List</TableHead>
                  <TableHead>Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer" onClick={() => setOpenTaskId(t.id)}>
                    <TableCell className="max-w-[20rem]">
                      <span className="block truncate font-medium">{t.title}</span>
                      {t._count.blockedBy > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                          <Lock className="size-3" /> waits on {t._count.blockedBy}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <PriorityBadge priority={t.priority} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <AssigneeAvatars assignees={t.assignees} size="sm" showNames />
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{t.list?.name ?? "Unsorted"}</TableCell>
                    <TableCell className={cn("whitespace-nowrap text-sm", t.status === "OVERDUE" ? "font-medium text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>
                      {formatDate(t.dueDate, "d MMM")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}

      {view === "timeline" && (
        <ProjectTimeline
          project={{ startDate: project.startDate, dueDate: project.dueDate, color: project.color }}
          tasks={tasks}
          milestones={project.milestones}
          lists={project.lists}
          taskHref="/my-tasks"
        />
      )}

      {view === "calendar" && <ProjectCalendar tasks={tasks} onOpen={setOpenTaskId} />}

      {view === "overview" && <Overview data={data} tasks={tasks} currentUserId={currentUserId} />}

      {view === "discussions" && (
        <CommentSection
          target={{ projectId: project.id }}
          comments={project.comments}
          currentUserId={currentUserId}
          users={users}
          canComment={access.canComment}
          canModerate={access.canManage}
          title="Project discussion"
          description="Announcements, questions and decisions for the whole project. Use @ to mention someone."
          layout="composer-bottom"
        />
      )}

      <TaskModal taskId={openTaskId} onOpenChange={(o) => !o && setOpenTaskId(null)} users={users} taskHref="/my-tasks" options={options} />
      {options && (
        <TaskFormDialog
          open={creatingIn !== false}
          onOpenChange={(o) => !o && setCreatingIn(false)}
          options={options}
          defaults={{ projectId: project.id, listId: creatingIn || "" }}
          lockProject
        />
      )}
      {/* keep stats referenced for the overview tab */}
      <span className="hidden">{stats.total}</span>
    </>
  );
}

function BoardCard({
  task,
  lists,
  draggable,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  task: ProjectTask;
  lists: { id: string; name: string }[];
  draggable: boolean;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onMove: (listId: string | null) => void;
}) {
  const overdue = task.status === "OVERDUE";
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group rounded-lg border bg-card p-3 text-left shadow-xs transition-colors hover:border-primary/40 hover:bg-accent/40",
        draggable && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-40",
        task.status === "COMPLETED" && "opacity-75",
      )}
    >
      <div className="flex items-start gap-1">
        {draggable && <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" aria-hidden />}
        <button type="button" onClick={onOpen} draggable={false} className="line-clamp-2 min-w-0 flex-1 text-left text-sm font-medium leading-snug hover:underline">
          {task.title}
        </button>
        {draggable && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" className="-mt-0.5 -mr-1 shrink-0" aria-label="Move task" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              {lists.map((l) => (
                <DropdownMenuItem key={l.id} disabled={l.id === task.listId} onClick={() => onMove(l.id)}>
                  <FolderInput /> {l.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: overdue ? STATUS_COLORS.OVERDUE : PRIORITY_COLORS[task.priority] }} />
          <span className={cn(overdue && "font-medium text-rose-600 dark:text-rose-400")}>{formatDate(task.dueDate, "d MMM")}</span>
          {task._count.blockedBy > 0 && <Lock className="size-3 text-amber-600" />}
        </span>
        <AssigneeAvatars assignees={task.assignees} size="xs" max={3} />
      </div>
    </div>
  );
}

function Overview({ data, tasks, currentUserId }: { data: ProjectDetail; tasks: ProjectTask[]; currentUserId: string }) {
  const { project } = data;
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "COMPLETED").length;
  const overdue = tasks.filter((t) => t.status === "OVERDUE").length;
  const progress = total ? Math.round(tasks.reduce((s, t) => s + t.completion, 0) / total) : 0;
  const byStatus = TASK_STATUSES.map((s) => ({ status: s, count: tasks.filter((t) => t.status === s).length }));
  const workload = project.members
    .map((m) => ({ id: m.userId, name: m.userId === currentUserId ? "You" : m.user.name, count: tasks.filter((t) => t.assignees.some((a) => a.userId === m.userId)).length }))
    .sort((a, b) => b.count - a.count);
  const maxLoad = Math.max(1, ...workload.map((w) => w.count));
  const milestonesDone = project.milestones.filter((m) => m.completedAt).length;

  const card = (label: string, value: React.ReactNode, hint: string, tone = "") => (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-3xl font-semibold tabular-nums", tone)}>{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {card("Progress", `${progress}%`, `${done} of ${total} tasks done`)}
        {card("Overdue", overdue, "tasks past due date", overdue > 0 ? "text-rose-600 dark:text-rose-400" : "")}
        {card("Milestones", `${milestonesDone}/${project.milestones.length}`, "reached")}
        {card("Members", project.members.length, "on this project")}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <p className="mb-3 text-sm font-medium">Tasks by status</p>
          <ul className="space-y-2.5">
            {byStatus.map((row) => (
              <li key={row.status} className="flex items-center gap-3 text-sm">
                <span className="w-24 text-muted-foreground">{STATUS_LABELS[row.status]}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full" style={{ width: `${total ? (row.count / total) * 100 : 0}%`, backgroundColor: STATUS_COLORS[row.status] }} />
                </span>
                <span className="w-6 text-right tabular-nums">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="mb-3 text-sm font-medium">Workload by person</p>
          {workload.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {workload.map((w) => (
                <li key={w.id} className="flex items-center gap-3 text-sm">
                  <span className="w-28 truncate text-muted-foreground">{w.name}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(w.count / maxLoad) * 100}%` }} />
                  </span>
                  <span className="w-6 text-right tabular-nums">{w.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {project.milestones.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <p className="mb-3 text-sm font-medium">Milestones</p>
          <ul className="divide-y">
            {project.milestones.map((m) => {
              const mt = project.tasks.filter((t) => t.milestoneId === m.id);
              const md = mt.filter((t) => t.status === "COMPLETED").length;
              return (
                <li key={m.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className={cn("size-2.5 rounded-full", m.completedAt ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                  <span className={cn("min-w-0 flex-1 truncate", m.completedAt && "text-muted-foreground line-through")}>{m.title}</span>
                  <span className="text-xs text-muted-foreground">{m.dueDate ? formatDate(m.dueDate, "d MMM") : ""}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {md}/{mt.length}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
