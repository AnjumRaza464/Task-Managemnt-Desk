import "server-only";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, UnauthorizedError, type CurrentUser } from "@/lib/auth-guard";
import type { Prisma } from "@/generated/prisma/client";
import type { ProjectRole } from "@/generated/prisma/enums";
import { isGlobalRole } from "@/lib/constants";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * What the signed-in user may do inside one project.
 *
 * - ADMIN / CEO: everything, in every project.
 * - MANAGER: only the projects they belong to (created, assigned a task in,
 *   or assigned to), with full project powers there.
 * - Project OWNER / MANAGER: manage the project (lists, milestones, members,
 *   every task, settings).
 * - Project MEMBER: create tasks, move tasks between lists, update tasks
 *   assigned to them, comment.
 * - Project VIEWER: read and comment only.
 */
export type ProjectAccess = {
  projectId: string;
  role: ProjectRole | null;
  /** Admin: sees and manages every project (and may delete them). */
  isGlobalManager: boolean;
  canView: boolean;
  canComment: boolean;
  canEdit: boolean;
  canManage: boolean;
};

export const PROJECT_ROLE_RANK: Record<ProjectRole, number> = { VIEWER: 0, MEMBER: 1, MANAGER: 2, OWNER: 3 };

export function accessFromRole(projectId: string, user: CurrentUser, role: ProjectRole | null): ProjectAccess | null {
  const isGlobalManager = isGlobalRole(user.role);
  if (isGlobalManager) {
    return { projectId, role, isGlobalManager, canView: true, canComment: true, canEdit: true, canManage: true };
  }
  if (!role) return null;
  // A manager runs every project they are part of, whatever row they were added with.
  const rank = user.role === "MANAGER" ? Math.max(PROJECT_ROLE_RANK[role], PROJECT_ROLE_RANK.MANAGER) : PROJECT_ROLE_RANK[role];
  return {
    projectId,
    role,
    isGlobalManager,
    canView: true,
    canComment: true,
    canEdit: rank >= PROJECT_ROLE_RANK.MEMBER,
    canManage: rank >= PROJECT_ROLE_RANK.MANAGER,
  };
}

export async function getProjectAccess(user: CurrentUser, projectId: string, db: Db = prisma): Promise<ProjectAccess | null> {
  if (isGlobalRole(user.role)) {
    const exists = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
    return exists ? accessFromRole(projectId, user, null) : null;
  }
  const member = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    select: { role: true },
  });
  return accessFromRole(projectId, user, member?.role ?? null);
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError("Please sign in again.");
  return user;
}

export type AccessLevel = "view" | "comment" | "edit" | "manage";

const LEVEL_MESSAGE: Record<AccessLevel, string> = {
  view: "You do not have access to this project.",
  comment: "You cannot comment in this project.",
  edit: "You need to be a member of this project to do that.",
  manage: "Only project managers can do that.",
};

/** For server actions: resolves the user and checks their project access level. */
export async function requireProjectAccess(projectId: string, level: AccessLevel, db: Db = prisma) {
  const user = await requireUser();
  const access = await getProjectAccess(user, projectId, db);
  if (!access) throw new UnauthorizedError(LEVEL_MESSAGE.view);
  const ok =
    level === "view" ? access.canView : level === "comment" ? access.canComment : level === "edit" ? access.canEdit : access.canManage;
  if (!ok) throw new UnauthorizedError(LEVEL_MESSAGE[level]);
  return { user, access };
}

export type TaskAccess = {
  canView: boolean;
  /** Status / completion updates (assignees and project managers). */
  canUpdateProgress: boolean;
  /** Move between lists, add subtasks, attachments (project members). */
  canEdit: boolean;
  /** Full edit, assign, delete. */
  canManage: boolean;
  canComment: boolean;
  isAssignee: boolean;
};

export type TaskForAccess = { id: string; projectId: string | null; createdById: string; assignees: { userId: string }[] };

const NO_TASK_ACCESS = (isAssignee: boolean): TaskAccess => ({ canView: false, canUpdateProgress: false, canEdit: false, canManage: false, canComment: false, isAssignee });

/**
 * Where-clause for the tasks a user may see inside a project: a manager only
 * their own (created or assigned to them); admins and members see them all
 * (undefined = no extra filter).
 */
export function ownTasksWhere(user: CurrentUser): Prisma.TaskWhereInput | undefined {
  if (user.role !== "MANAGER") return undefined;
  return { OR: [{ createdById: user.id }, { assignees: { some: { userId: user.id } } }] };
}

export async function getTaskAccess(user: CurrentUser, task: TaskForAccess, db: Db = prisma): Promise<TaskAccess> {
  const isAssignee = task.assignees.some((a) => a.userId === user.id);
  if (isGlobalRole(user.role)) {
    return { canView: true, canUpdateProgress: true, canEdit: true, canManage: true, canComment: true, isAssignee };
  }
  // A manager only sees the tasks they created or are assigned to, and keeps full control of those.
  const isOwner = user.role === "MANAGER" && task.createdById === user.id;
  if (user.role === "MANAGER" && !isOwner && !isAssignee) return NO_TASK_ACCESS(isAssignee);
  const project = task.projectId ? await getProjectAccess(user, task.projectId, db) : null;
  const canView = isAssignee || isOwner || Boolean(project?.canView);
  return {
    canView,
    canUpdateProgress: isAssignee || isOwner || Boolean(project?.canManage),
    canEdit: isAssignee || isOwner || Boolean(project?.canEdit),
    canManage: isOwner || Boolean(project?.canManage),
    canComment: canView,
    isAssignee,
  };
}

const TASK_LEVEL_MESSAGE: Record<keyof Omit<TaskAccess, "isAssignee">, string> = {
  canView: "You do not have access to this task.",
  canUpdateProgress: "You can only update tasks assigned to you.",
  canEdit: "You cannot change this task.",
  canManage: "Only managers can do that.",
  canComment: "You cannot comment on this task.",
};

/** For server actions: loads the task's access fields and checks one capability. */
export async function requireTaskAccess(taskId: string, level: keyof Omit<TaskAccess, "isAssignee">, db: Db = prisma) {
  const user = await requireUser();
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true, createdById: true, assignees: { select: { userId: true } } },
  });
  if (!task) throw new UnauthorizedError("Task not found.");
  const access = await getTaskAccess(user, task, db);
  if (!access[level]) throw new UnauthorizedError(TASK_LEVEL_MESSAGE[level]);
  return { user, access, task };
}

/** Ids of the projects the user belongs to (every project for admins and the CEO → null). */
export async function visibleProjectIds(user: CurrentUser, db: Db = prisma): Promise<string[] | null> {
  if (isGlobalRole(user.role)) return null;
  const rows = await db.projectMember.findMany({ where: { userId: user.id }, select: { projectId: true } });
  return rows.map((r) => r.projectId);
}
