import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDeliverableEmail, renderEmail, sendEmails, type EmailMessage, type EmailTemplate } from "@/lib/email";
import type { NotificationType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient | typeof prisma;

export async function logActivity(
  input: {
    actorId: string;
    action: string;
    entity: "Task" | "User" | "MonthlyPlan" | "Category" | "SubTask" | "Comment" | "Attachment" | "SharedFile";
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

/** Email sent alongside an in-app notification; the subject defaults to the heading. */
export type NotificationEmail = EmailTemplate & { subject?: string };

export type NotifyInput = {
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  taskId?: string | null;
  /** Prevents the same notification (per user) being created twice. */
  dedupeKey?: string;
  excludeUserId?: string;
  excludeUserIds?: string[];
  /** When set, recipients who have email notifications on also get this email. */
  email?: NotificationEmail;
};

/**
 * Creates an in-app notification for each user (deduplicated by `dedupeKey`)
 * and, when `email` is given, queues an email to the users who opted in. The
 * emails go out after the response is sent so they never slow the request.
 * Returns the ids of the users who actually received a new notification.
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
      type: input.type,
      title: input.title,
      message: input.message,
      dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${userId}` : null,
    })),
    skipDuplicates: true,
  });

  if (input.email) await queueEmails(targets, input.email, tx);
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

async function queueEmails(userIds: string[], template: NotificationEmail, tx: Tx) {
  const users = await tx.user.findMany({
    where: { id: { in: userIds }, isActive: true, emailNotifications: true },
    select: { name: true, email: true },
  });
  const messages: EmailMessage[] = users
    .filter((u) => isDeliverableEmail(u.email))
    .map((u) => {
      const { subject, ...rest } = template;
      const { html, text } = renderEmail({ ...rest, greeting: rest.greeting ?? `Hi ${u.name.split(" ")[0]},` });
      return { to: u.email, subject: subject ?? rest.heading, html, text };
    });
  if (messages.length === 0) return;

  try {
    after(() => sendEmails(messages));
  } catch {
    // Outside a request (scripts): send without waiting.
    void sendEmails(messages);
  }
}
