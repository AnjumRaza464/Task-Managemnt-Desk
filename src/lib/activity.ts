import "server-only";
import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient | typeof prisma;

export async function logActivity(
  input: {
    actorId: string;
    action: string;
    entity: "Task" | "User" | "MonthlyPlan" | "Category" | "SubTask" | "Comment" | "Attachment";
    entityId: string;
    taskId?: string | null;
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
      details: input.details,
    },
  });
}

/**
 * Creates an in-app notification for every active manager/admin.
 * `dedupeKey` prevents the same notification being created twice.
 */
export async function notifyManagers(
  input: {
    type: NotificationType;
    title: string;
    message: string;
    taskId?: string | null;
    dedupeKey?: string;
    excludeUserId?: string;
  },
  tx: Tx = prisma,
) {
  const managers = await tx.user.findMany({
    where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true },
    select: { id: true },
  });

  const rows = managers
    .filter((m) => m.id !== input.excludeUserId)
    .map((m) => ({
      userId: m.id,
      taskId: input.taskId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${m.id}` : null,
    }));

  if (rows.length === 0) return;
  await tx.notification.createMany({ data: rows, skipDuplicates: true });
}
