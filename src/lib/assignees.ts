import "server-only";
import { ActionError } from "@/lib/action-result";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export type AssigneeUser = { id: string; name: string };

/** Loads the given users and makes sure every one of them exists and is active. */
export async function assertActiveUsers(tx: Tx, userIds: string[]): Promise<AssigneeUser[]> {
  const ids = [...new Set(userIds)];
  const users = await tx.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, isActive: true },
  });
  if (users.length !== ids.length) throw new ActionError("One of the assigned users no longer exists.");
  const inactive = users.filter((u) => !u.isActive);
  if (inactive.length > 0) {
    throw new ActionError(`Cannot assign tasks to an inactive user (${inactive.map((u) => u.name).join(", ")}).`);
  }
  // Keep the caller's order (the first id is the primary assignee).
  const byId = new Map(users.map((u) => [u.id, { id: u.id, name: u.name }]));
  return ids.map((id) => byId.get(id)!);
}

/**
 * Makes the TaskAssignee rows of a task match `assigneeIds`. Returns who was
 * added and who was removed so callers can notify and log.
 */
export async function syncTaskAssignees(tx: Tx, taskId: string, assigneeIds: string[], actorId: string) {
  const current = await tx.taskAssignee.findMany({ where: { taskId }, select: { userId: true } });
  const have = new Set(current.map((a) => a.userId));
  const want = new Set(assigneeIds);
  const added = assigneeIds.filter((id) => !have.has(id));
  const removed = [...have].filter((id) => !want.has(id));

  if (added.length > 0) {
    await tx.taskAssignee.createMany({
      data: added.map((userId) => ({ taskId, userId, assignedById: actorId })),
      skipDuplicates: true,
    });
  }
  if (removed.length > 0) {
    await tx.taskAssignee.deleteMany({ where: { taskId, userId: { in: removed } } });
  }
  return { added, removed };
}

export function assigneeNames(users: { name: string }[]): string {
  if (users.length === 0) return "nobody";
  if (users.length <= 3) return users.map((u) => u.name).join(", ");
  return `${users
    .slice(0, 2)
    .map((u) => u.name)
    .join(", ")} and ${users.length - 2} others`;
}
