import "server-only";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/auth-guard";
import { getProjectAccess, visibleProjectIds } from "@/lib/permissions";
import { assigneeSelect } from "@/lib/queries/selects";
import type { Prisma } from "@/generated/prisma/client";

const projectCardSelect = {
  id: true,
  name: true,
  description: true,
  color: true,
  status: true,
  startDate: true,
  dueDate: true,
  position: true,
  updatedAt: true,
  members: { select: { userId: true, role: true, user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
  tasks: { select: { status: true, completion: true } },
  _count: { select: { lists: true, milestones: true } },
} satisfies Prisma.ProjectSelect;

function projectStats(tasks: { status: string; completion: number }[]) {
  const count = (s: string) => tasks.filter((t) => t.status === s).length;
  return {
    total: tasks.length,
    completed: count("COMPLETED"),
    inProgress: count("IN_PROGRESS"),
    pending: count("PENDING"),
    overdue: count("OVERDUE"),
    progress: tasks.length ? Math.round(tasks.reduce((s, t) => s + t.completion, 0) / tasks.length) : 0,
  };
}

/** Every workspace with its projects (members only see projects they belong to). */
export async function getWorkspacesOverview(user: CurrentUser) {
  const ids = await visibleProjectIds(user);
  const workspaces = await prisma.workspace.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      createdAt: true,
      projects: {
        where: ids ? { id: { in: ids } } : undefined,
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: projectCardSelect,
      },
    },
  });
  return workspaces
    .map((w) => ({
      ...w,
      projects: w.projects.map(({ tasks, ...p }) => ({ ...p, stats: projectStats(tasks) })),
    }))
    .filter((w) => !ids || w.projects.length > 0);
}

export type WorkspaceOverview = Awaited<ReturnType<typeof getWorkspacesOverview>>[number];
export type ProjectCard = WorkspaceOverview["projects"][number];

export const projectTaskInclude = {
  assignee: { select: { id: true, name: true, email: true } },
  assignees: assigneeSelect,
  category: { select: { id: true, name: true, color: true } },
  plan: { select: { id: true, year: true, month: true } },
  project: { select: { id: true, name: true, color: true } },
  list: { select: { id: true, name: true } },
  milestone: { select: { id: true, title: true } },
  _count: { select: { subtasks: true, comments: true, attachments: true, blockedBy: true } },
  subtasks: { select: { isCompleted: true } },
  blockedBy: { select: { blocker: { select: { id: true, title: true, status: true } } } },
} satisfies Prisma.TaskInclude;

export type ProjectTask = Prisma.TaskGetPayload<{ include: typeof projectTaskInclude }>;

/** Full project page data, or null when it does not exist / the user may not see it. */
export async function getProjectForUser(id: string, user: CurrentUser) {
  const access = await getProjectAccess(user, id);
  if (!access) return null;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      workspace: { select: { id: true, name: true, color: true } },
      createdBy: { select: { id: true, name: true } },
      members: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, email: true, role: true, designation: true, isActive: true } } },
      },
      lists: { orderBy: { position: "asc" } },
      milestones: {
        orderBy: [{ position: "asc" }, { dueDate: "asc" }],
        include: { tasks: { select: { id: true, status: true, completion: true } } },
      },
      tasks: { include: projectTaskInclude, orderBy: [{ position: "asc" }, { dueDate: "asc" }] },
      comments: {
        where: { parentId: null },
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { id: true, name: true } },
          mentions: { select: { userId: true } },
          replies: {
            orderBy: { createdAt: "asc" },
            include: { author: { select: { id: true, name: true } }, mentions: { select: { userId: true } } },
          },
        },
      },
      activity: {
        orderBy: { createdAt: "desc" },
        take: 40,
        include: { actor: { select: { name: true } }, task: { select: { id: true, title: true } } },
      },
    },
  });
  if (!project) return null;
  return { project, access, stats: projectStats(project.tasks) };
}

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProjectForUser>>>;

/** Projects (with their lists and milestones) the user may put tasks in, for the task form. */
export async function getProjectOptions(user: CurrentUser) {
  const ids = await visibleProjectIds(user);
  const projects = await prisma.project.findMany({
    where: { status: { in: ["ACTIVE", "ON_HOLD"] }, ...(ids ? { id: { in: ids } } : {}) },
    orderBy: [{ workspace: { name: "asc" } }, { position: "asc" }],
    select: {
      id: true,
      name: true,
      color: true,
      workspace: { select: { name: true } },
      lists: { orderBy: { position: "asc" }, select: { id: true, name: true } },
      milestones: { where: { completedAt: null }, orderBy: { position: "asc" }, select: { id: true, title: true } },
      members: { select: { userId: true } },
    },
  });
  return projects.map((p) => ({ ...p, memberIds: p.members.map((m) => m.userId), members: undefined }));
}

export type ProjectOption = Awaited<ReturnType<typeof getProjectOptions>>[number];

/** Projects a member belongs to, for the member navigation and overview. */
export async function getMyProjects(userId: string) {
  const rows = await prisma.projectMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      project: { select: { ...projectCardSelect, workspace: { select: { id: true, name: true, color: true } } } },
    },
  });
  return rows.map(({ role, project: { tasks, ...p } }) => ({ ...p, myRole: role, stats: projectStats(tasks) }));
}

export type MyProject = Awaited<ReturnType<typeof getMyProjects>>[number];

export async function getWorkspaceOptions() {
  return prisma.workspace.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, color: true } });
}
