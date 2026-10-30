import "server-only";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, UnauthorizedError, type CurrentUser } from "@/lib/auth-guard";
import type { Prisma } from "@/generated/prisma/client";
import type { ProjectRole } from "@/generated/prisma/enums";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * What the signed-in user may do inside one project.
 *
 * - Global ADMIN / MANAGER: everything, in every project.
 * - Project OWNER / MANAGER: manage the project (lists, milestones, members,
 *   every task, settings).
 * - Project MEMBER: create tasks, move tasks between lists, update tasks
 *   assigned to them, comment.
 * - Project VIEWER: read and comment only.
 */
export type ProjectAccess = {
  projectId: string;
  role: ProjectRole | null;
  isGlobalManager: boolean;
  canView: boolean;
  canComment: boolean;
  canEdit: boolean;
  canManage: boolean;
};

export const PROJECT_ROLE_RANK: Record<ProjectRole, number> = { VIEWER: 0, MEMBER: 1, MANAGER: 2, OWNER: 3 };

export function accessFromRole(projectId: string, user: CurrentUser, role: ProjectRole | null): ProjectAccess | null {
  const isGlobalManager = user.role !== "MEMBER";
  if (isGlobalManager) {
    return { projectId, role, isGlobalManager, canView: true, canComment: true, canEdit: true, canManage: true };
  }
  if (!role) return null;
  const rank = PROJECT_ROLE_RANK[role];
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
  if (user.role !== "MEMBER") {
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

type TaskForAccess = { id: string; projectId: string | null; assignees: { userId: string }[] };

export async function getTaskAccess(user: CurrentUser, task: TaskForAccess, db: Db = prisma): Promise<TaskAccess> {
  const isAssignee = task.assignees.some((a) => a.userId === user.id);
  if (user.role !== "MEMBER") {
    return { canView: true, canUpdateProgress: true, canEdit: true, canManage: true, canComment: true, isAssignee };
  }
  const project = task.projectId ? await getProjectAccess(user, task.projectId, db) : null;
  const canView = isAssignee || Boolean(project?.canView);
  return {
    canView,
    canUpdateProgress: isAssignee || Boolean(project?.canManage),
    canEdit: isAssignee || Boolean(project?.canEdit),
    canManage: Boolean(project?.canManage),
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
    select: { id: true, projectId: true, assignees: { select: { userId: true } } },
  });
  if (!task) throw new UnauthorizedError("Task not found.");
  const access = await getTaskAccess(user, task, db);
  if (!access[level]) throw new UnauthorizedError(TASK_LEVEL_MESSAGE[level]);
  return { user, access, task };
}

/** Ids of the projects a member can see (every project for global managers → null). */
export async function visibleProjectIds(user: CurrentUser, db: Db = prisma): Promise<string[] | null> {
  if (user.role !== "MEMBER") return null;
  const rows = await db.projectMember.findMany({ where: { userId: user.id }, select: { projectId: true } });
  return rows.map((r) => r.projectId);
}
