import "server-only";
import { addDays, addMonths, addWeeks, differenceInCalendarDays } from "date-fns";
import { logActivity, notifyUsers } from "@/lib/activity";
import type { Prisma } from "@/generated/prisma/client";
import type { Priority, Recurrence } from "@/generated/prisma/enums";

type Tx = Prisma.TransactionClient;

/** Finds or creates the (user, year, month) plan a task with this due date belongs to. */
export async function resolvePlan(tx: Tx, assigneeId: string, dueDate: Date) {
  const year = dueDate.getFullYear();
  const month = dueDate.getMonth() + 1;
  return tx.monthlyPlan.upsert({
    where: { userId_year_month: { userId: assigneeId, year, month } },
    update: {},
    create: { userId: assigneeId, year, month },
  });
}

export function nextOccurrenceDate(dueDate: Date, recurrence: Recurrence): Date | null {
  switch (recurrence) {
    case "DAILY":
      return addDays(dueDate, 1);
    case "WEEKLY":
      return addWeeks(dueDate, 1);
    case "BIWEEKLY":
      return addWeeks(dueDate, 2);
    case "MONTHLY":
      return addMonths(dueDate, 1);
    default:
      return null;
  }
}

type RecurringTask = {
  id: string;
  title: string;
  description: string | null;
  assigneeId: string;
  createdById: string;
  categoryId: string | null;
  priority: Priority;
  recurrence: Recurrence;
  recurrenceEndsAt: Date | null;
  recurrenceParentId: string | null;
  recurrenceSpawnedAt: Date | null;
  startDate: Date | null;
  dueDate: Date;
};

/**
 * Called when a task is completed. For a repeating task that has not spawned
 * yet, creates the next occurrence (same assignee, category, priority and
 * subtasks) in the right monthly plan and notifies the assignee.
 * Returns the new task, or null when nothing was created.
 */
export async function spawnNextOccurrence(tx: Tx, task: RecurringTask, actorId: string) {
  if (task.recurrence === "NONE" || task.recurrenceSpawnedAt) return null;

  const nextDue = nextOccurrenceDate(task.dueDate, task.recurrence);
  if (!nextDue) return null;

  // Mark first so completing the same task again cannot spawn twice.
  await tx.task.update({ where: { id: task.id }, data: { recurrenceSpawnedAt: new Date() } });
  if (task.recurrenceEndsAt && nextDue > task.recurrenceEndsAt) return null;

  const assigneeRows = await tx.taskAssignee.findMany({
    where: { taskId: task.id, user: { isActive: true } },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  const assigneeIds = assigneeRows.map((a) => a.userId);
  if (!assigneeIds.includes(task.assigneeId)) {
    const primary = await tx.user.findUnique({ where: { id: task.assigneeId }, select: { isActive: true } });
    if (primary?.isActive) assigneeIds.unshift(task.assigneeId);
  }
  if (assigneeIds.length === 0) return null;
  const primaryId = assigneeIds.includes(task.assigneeId) ? task.assigneeId : assigneeIds[0];

  const plan = await resolvePlan(tx, primaryId, nextDue);
  const subtasks = await tx.subTask.findMany({
    where: { taskId: task.id },
    orderBy: { position: "asc" },
    select: { title: true, position: true },
  });
  const lastPosition = await tx.task.aggregate({ _max: { position: true }, where: { status: "PENDING" } });
  const startOffset = task.startDate ? differenceInCalendarDays(task.dueDate, task.startDate) : null;

  const created = await tx.task.create({
    data: {
      title: task.title,
      description: task.description,
      planId: plan.id,
      assigneeId: primaryId,
      createdById: task.createdById,
      categoryId: task.categoryId,
      priority: task.priority,
      status: "PENDING",
      completion: 0,
      startDate: startOffset !== null ? addDays(nextDue, -startOffset) : null,
      dueDate: nextDue,
      position: (lastPosition._max.position ?? 0) + 1,
      recurrence: task.recurrence,
      recurrenceEndsAt: task.recurrenceEndsAt,
      recurrenceParentId: task.recurrenceParentId ?? task.id,
      subtasks: { create: subtasks.map((s) => ({ title: s.title, position: s.position })) },
      assignees: { create: assigneeIds.map((userId) => ({ userId, assignedById: actorId })) },
    },
  });

  await logActivity(
    {
      actorId,
      action: "TASK_RECURRED",
      entity: "Task",
      entityId: created.id,
      taskId: created.id,
      details: { title: created.title, from: task.id, dueDate: nextDue.toISOString() },
    },
    tx,
  );
  await notifyUsers(
    {
      userIds: assigneeIds,
      type: "TASK_ASSIGNED",
      title: "Repeating task scheduled",
      message: `The next "${created.title}" is due ${nextDue.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`,
      taskId: created.id,
    },
    tx,
  );
  return created;
}
