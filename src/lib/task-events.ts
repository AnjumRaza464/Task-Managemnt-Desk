import "server-only";
import { format } from "date-fns";
import { ActionError } from "@/lib/action-result";
import { logActivity, notifyUsers } from "@/lib/activity";
import { spawnNextOccurrence } from "@/lib/recurrence";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

const OPEN_STATUSES = ["PENDING", "IN_PROGRESS", "OVERDUE"] as const;

/** Throws when the task still waits on an unfinished blocker. */
export async function assertNotBlocked(tx: Tx, taskId: string) {
  const open = await tx.taskDependency.findMany({
    where: { blockedId: taskId, blocker: { status: { in: [...OPEN_STATUSES] } } },
    select: { blocker: { select: { title: true } } },
  });
  if (open.length > 0) {
    const names = open.map((d) => `"${d.blocker.title}"`).join(", ");
    throw new ActionError(`This task is blocked until ${names} ${open.length === 1 ? "is" : "are"} completed.`);
  }
}

type CompletedTask = Parameters<typeof spawnNextOccurrence>[1] & { milestoneId: string | null; projectId: string | null };

/**
 * Everything that follows a task being completed: the next occurrence of a
 * repeating task, "you are unblocked" notifications for tasks that waited on
 * it, and closing the milestone once all of its tasks are done.
 */
export async function onTaskCompleted(tx: Tx, task: CompletedTask, actorId: string) {
  await spawnNextOccurrence(tx, task, actorId);
  await notifyUnblocked(tx, task.id, task.title);
  if (task.milestoneId) await closeMilestoneIfDone(tx, task.milestoneId, actorId);
}

async function notifyUnblocked(tx: Tx, blockerId: string, blockerTitle: string) {
  const dependents = await tx.taskDependency.findMany({
    where: { blockerId },
    select: {
      blocked: {
        select: {
          id: true,
          title: true,
          dueDate: true,
          status: true,
          assignees: { select: { userId: true } },
          blockedBy: { select: { blocker: { select: { id: true, status: true } } } },
        },
      },
    },
  });
  for (const { blocked } of dependents) {
    if (blocked.status === "COMPLETED" || blocked.status === "CANCELLED") continue;
    const stillOpen = blocked.blockedBy.some(
      (d) => d.blocker.id !== blockerId && (OPEN_STATUSES as readonly string[]).includes(d.blocker.status),
    );
    if (stillOpen) continue;
    await notifyUsers(
      {
        userIds: blocked.assignees.map((a) => a.userId),
        type: "TASK_UNBLOCKED",
        title: "Task unblocked",
        message: `"${blockerTitle}" is done, so "${blocked.title}" (due ${format(blocked.dueDate, "MMM d")}) can start.`,
        taskId: blocked.id,
        dedupeKey: `UNBLOCKED:${blocked.id}:${blockerId}`,
      },
      tx,
    );
  }
}

export async function closeMilestoneIfDone(tx: Tx, milestoneId: string, actorId: string) {
  const milestone = await tx.milestone.findUnique({
    where: { id: milestoneId },
    select: {
      id: true,
      title: true,
      completedAt: true,
      projectId: true,
      project: { select: { name: true, members: { select: { userId: true } } } },
      tasks: { select: { status: true } },
    },
  });
  if (!milestone || milestone.completedAt || milestone.tasks.length === 0) return;
  const allDone = milestone.tasks.every((t) => t.status === "COMPLETED" || t.status === "CANCELLED");
  if (!allDone) return;
  await tx.milestone.update({ where: { id: milestoneId }, data: { completedAt: new Date() } });
  await logActivity(
    {
      actorId,
      action: "MILESTONE_COMPLETED",
      entity: "Milestone",
      entityId: milestoneId,
      projectId: milestone.projectId,
      details: { title: milestone.title, auto: true },
    },
    tx,
  );
  await notifyUsers(
    {
      userIds: milestone.project.members.map((m) => m.userId),
      type: "MILESTONE_REACHED",
      title: "Milestone reached",
      message: `Every task in "${milestone.title}" (${milestone.project.name}) is done.`,
      projectId: milestone.projectId,
      dedupeKey: `MILESTONE:${milestoneId}`,
    },
    tx,
  );
}
