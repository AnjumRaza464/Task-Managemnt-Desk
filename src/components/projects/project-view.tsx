import Link from "next/link";
import { ArrowLeft, CalendarDays, KanbanSquare, ListTodo, MessageSquare, Users, Activity as ActivityIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssigneeAvatars } from "@/components/shared/assignee-avatars";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectActivity } from "@/components/projects/project-activity";
import { ProjectBoard } from "@/components/projects/project-board";
import { ProjectHeaderActions } from "@/components/projects/project-header-actions";
import { ProjectMembers } from "@/components/projects/project-members";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { CommentSection } from "@/components/tasks/comment-section";
import { TaskTable } from "@/components/tasks/task-table";
import type { CurrentUser } from "@/lib/auth-guard";
import type { ProjectDetail } from "@/lib/queries/projects";
import type { TaskFormOptions } from "@/lib/queries/tasks";
import { cn, formatDate, toDateInputValue } from "@/lib/utils";

export type ProjectTab = "board" | "tasks" | "discussion" | "members" | "activity";

const TABS: { key: ProjectTab; label: string; icon: LucideIcon }[] = [
  { key: "board", label: "Board", icon: KanbanSquare },
  { key: "tasks", label: "Tasks", icon: ListTodo },
  { key: "discussion", label: "Discussion", icon: MessageSquare },
  { key: "members", label: "Members", icon: Users },
  { key: "activity", label: "Activity", icon: ActivityIcon },
];

export function parseProjectTab(value: string | string[] | undefined): ProjectTab {
  return typeof value === "string" && TABS.some((t) => t.key === value) ? (value as ProjectTab) : "board";
}

export function ProjectView({
  data,
  tab,
  user,
  options,
  users,
  workspaces,
  basePath,
  taskHref,
}: {
  data: ProjectDetail;
  tab: ProjectTab;
  user: CurrentUser;
  options: TaskFormOptions;
  users: { id: string; name: string; email?: string | null }[];
  workspaces: { id: string; name: string; color: string }[];
  /** "/projects" for managers, "/my-projects" for members. */
  basePath: string;
  /** "/tasks" for managers, "/my-tasks" for members. */
  taskHref: string;
}) {
  const { project, access, stats } = data;
  const isOwner = access.isGlobalManager || access.role === "OWNER";
  const memberAvatars = project.members.map((m) => ({ user: m.user }));
  const statCards = [
    ["Tasks", stats.total, ""],
    ["Completed", stats.completed, "text-emerald-600 dark:text-emerald-400"],
    ["In progress", stats.inProgress, "text-sky-600 dark:text-sky-400"],
    ["Overdue", stats.overdue, "text-rose-600 dark:text-rose-400"],
    ["Progress", `${stats.progress}%`, ""],
  ] as const;

  return (
    <>
      <PageHeader
        title={project.name}
        description={[project.workspace.name, project.description].filter(Boolean).join(" · ")}
      >
        <Button variant="outline" nativeButton={false} render={<Link href={basePath === "/projects" ? "/workspaces" : basePath} />}>
          <ArrowLeft /> All projects
        </Button>
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
          workspaces={workspaces}
          users={users}
          options={options}
          canEdit={access.canEdit}
          canManage={access.canManage}
          canDelete={access.isGlobalManager}
          backHref={basePath === "/projects" ? "/workspaces" : basePath}
        />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: project.color }} />
          <ProjectStatusBadge status={project.status} />
        </span>
        {(project.startDate || project.dueDate) && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" />
            {formatDate(project.startDate, "MMM d")} → {formatDate(project.dueDate, "MMM d, yyyy")}
          </span>
        )}
        <AssigneeAvatars assignees={memberAvatars} size="xs" max={6} showNames />
        <span>Created by {project.createdBy.name}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {statCards.map(([label, value, tone]) => (
          <div key={label} className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("mt-1 text-xl font-semibold tabular-nums", tone)}>{value}</p>
          </div>
        ))}
      </div>

      <nav className="flex flex-wrap items-center gap-1 border-b" aria-label="Project sections">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={`${basePath}/${project.id}?tab=${t.key}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
                active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="size-4" /> {t.label}
              {t.key === "members" && <span className="text-xs text-muted-foreground">{project.members.length}</span>}
              {t.key === "discussion" && project.comments.length > 0 && (
                <span className="text-xs text-muted-foreground">{project.comments.length}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {tab === "board" && (
        <ProjectBoard
          projectId={project.id}
          lists={project.lists}
          tasks={project.tasks}
          options={options}
          access={{ canEdit: access.canEdit, canManage: access.canManage }}
          currentUserId={user.id}
          taskHref={taskHref}
        />
      )}
      {tab === "tasks" && (
        <TaskTable
          tasks={project.tasks}
          options={options}
          sortable={false}
          taskHref={taskHref}
          canManage={access.canManage}
          emptyTitle="No tasks in this project"
          emptyDescription="Add a task from the board or the New task button."
        />
      )}
      {tab === "discussion" && (
        <CommentSection
          target={{ projectId: project.id }}
          comments={project.comments}
          currentUserId={user.id}
          users={users}
          canComment={access.canComment}
          canModerate={access.canManage}
          title="Project discussion"
          description="Announcements, questions and decisions for the whole project. Every member is notified of new posts; use @ to call someone in."
        />
      )}
      {tab === "members" && (
        <ProjectMembers
          projectId={project.id}
          members={project.members}
          users={users}
          canManage={access.canManage}
          isOwner={isOwner}
          currentUserId={user.id}
        />
      )}
      {tab === "activity" && <ProjectActivity activity={project.activity} taskHref={taskHref} />}
    </>
  );
}
