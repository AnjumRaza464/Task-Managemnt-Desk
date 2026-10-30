import "server-only";
import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient | typeof prisma;

export async function logActivity(
  input: {
    actorId: string;
    action: string;
    entity:
      | "Task"
      | "User"
      | "MonthlyPlan"
      | "Category"
      | "SubTask"
      | "Comment"
      | "Attachment"
      | "SharedFile"
      | "Workspace"
      | "Project"
      | "List"
      | "Milestone"
      | "TaskDependency";
    entityId: string;
    taskId?: string | null;
    projectId?: string | null;
    details?: Prisma.InputJsonValue;
  },
  tx: Tx = prisma,
) {
  await tx.activityLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      taskId: input.taskId ?? null,
      projectId: input.projectId ?? null,
      details: input.details,
    },
  });
}

export type NotifyInput = {
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  taskId?: string | null;
  projectId?: string | null;
  /** Prevents the same notification (per user) being created twice. */
  dedupeKey?: string;
  excludeUserId?: string;
  excludeUserIds?: string[];
};

/**
 * Creates an in-app notification for each user, skipping any that already
 * exists for the same `dedupeKey`. Returns the ids of the users who received
 * a new notification.
 */
export async function notifyUsers(input: NotifyInput, tx: Tx = prisma): Promise<string[]> {
  const excluded = new Set([input.excludeUserId, ...(input.excludeUserIds ?? [])]);
  const ids = [...new Set(input.userIds)].filter((id) => !excluded.has(id));
  if (ids.length === 0) return [];

  let targets = ids;
  if (input.dedupeKey) {
    const key = input.dedupeKey;
    const existing = await tx.notification.findMany({
      where: { dedupeKey: { in: ids.map((id) => `${key}:${id}`) } },
      select: { dedupeKey: true },
    });
    const seen = new Set(existing.map((e) => e.dedupeKey));
    targets = ids.filter((id) => !seen.has(`${key}:${id}`));
  }
  if (targets.length === 0) return [];

  await tx.notification.createMany({
    data: targets.map((userId) => ({
      userId,
      taskId: input.taskId ?? null,
      projectId: input.projectId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${userId}` : null,
    })),
    skipDuplicates: true,
  });
  return targets;
}

/** Same as notifyUsers for every active admin/manager. */
export async function notifyManagers(input: Omit<NotifyInput, "userIds">, tx: Tx = prisma): Promise<string[]> {
  const managers = await tx.user.findMany({
    where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true },
    select: { id: true },
  });
  return notifyUsers({ ...input, userIds: managers.map((m) => m.id) }, tx);
}
