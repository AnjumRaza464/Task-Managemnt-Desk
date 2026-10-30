"use server";

import { prisma } from "@/lib/prisma";
import { ActionError, runAction } from "@/lib/action-result";
import { logActivity, notifyUsers } from "@/lib/activity";
import { getTaskAccess, requireTaskAccess } from "@/lib/permissions";
import { revalidateProjectViews } from "@/lib/project-members";
import { revalidateTaskViews } from "@/lib/task-views";
import { dependencySchema } from "@/lib/validations/project";

/** True when `from` (transitively) waits on `target`, i.e. adding target→from would loop. */
async function reaches(from: string, target: string): Promise<boolean> {
  const seen = new Set<string>();
  let frontier = [from];
  while (frontier.length > 0) {
    if (frontier.includes(target)) return true;
    const rows = await prisma.taskDependency.findMany({
      where: { blockedId: { in: frontier } },
      select: { blockerId: true },
    });
    frontier = rows.map((r) => r.blockerId).filter((id) => !seen.has(id));
    for (const id of frontier) seen.add(id);
  }
  return false;
}

/** Makes `taskId` wait for `blockerId`. */
export async function addDependency(input: unknown) {
  return runAction(async () => {
    const { taskId, blockerId } = dependencySchema.parse(input);
    if (taskId === blockerId) throw new ActionError("A task cannot depend on itself.");
    const { user } = await requireTaskAccess(taskId, "canEdit");
    const blocker = await prisma.task.findUnique({
      where: { id: blockerId },
      select: { id: true, title: true, projectId: true, assignees: { select: { userId: true } } },
    });
    if (!blocker) throw new ActionError("The other task no longer exists.");
    const blockerAccess = await getTaskAccess(user, blocker);
    if (!blockerAccess.canView) throw new ActionError("You do not have access to the other task.");
    if (await reaches(blockerId, taskId)) throw new ActionError("That would create a circular dependency.");

    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { title: true, projectId: true } });
    await prisma.$transaction(async (tx) => {
      await tx.taskDependency.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId: taskId } },
        update: {},
        create: { blockerId, blockedId: taskId },
      });
      await logActivity(
        {
          actorId: user.id,
          action: "DEPENDENCY_ADDED",
          entity: "TaskDependency",
          entityId: `${blockerId}:${taskId}`,
          taskId,
          projectId: task?.projectId ?? null,
          details: { title: task?.title, blocker: blocker.title },
        },
        tx,
      );
      await notifyUsers(
        {
          userIds: blocker.assignees.map((a) => a.userId),
          type: "SYSTEM",
          title: "A task is waiting on you",
          message: `"${task?.title}" cannot be completed until "${blocker.title}" is done.`,
          taskId: blockerId,
          excludeUserId: user.id,
          dedupeKey: `DEPENDS:${blockerId}:${taskId}`,
        },
        tx,
      );
    });
    revalidateTaskViews(taskId);
    revalidateTaskViews(blockerId);
    if (task?.projectId) revalidateProjectViews(task.projectId);
    return undefined;
  });
}

export async function removeDependency(input: unknown) {
  return runAction(async () => {
    const { taskId, blockerId } = dependencySchema.parse(input);
    const { user } = await requireTaskAccess(taskId, "canEdit");
    const existing = await prisma.taskDependency.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId: taskId } },
      select: { blocker: { select: { title: true } }, blocked: { select: { title: true, projectId: true } } },
    });
    if (!existing) throw new ActionError("That dependency no longer exists.");
    await prisma.$transaction(async (tx) => {
      await tx.taskDependency.delete({ where: { blockerId_blockedId: { blockerId, blockedId: taskId } } });
      await logActivity(
        {
          actorId: user.id,
          action: "DEPENDENCY_REMOVED",
          entity: "TaskDependency",
          entityId: `${blockerId}:${taskId}`,
          taskId,
          projectId: existing.blocked.projectId,
          details: { title: existing.blocked.title, blocker: existing.blocker.title },
        },
        tx,
      );
    });
    revalidateTaskViews(taskId);
    revalidateTaskViews(blockerId);
    if (existing.blocked.projectId) revalidateProjectViews(existing.blocked.projectId);
    return undefined;
  });
}
