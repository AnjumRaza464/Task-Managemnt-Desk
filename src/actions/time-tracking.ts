"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ActionError, runAction } from "@/lib/action-result";
import { logActivity } from "@/lib/activity";
import { requireTaskAccess } from "@/lib/permissions";

export type TaskTime = {
  /** Seconds logged by everyone, including timers still running. */
  totalSeconds: number;
  /** Seconds logged by the current user, including their running timer. */
  mySeconds: number;
  /** ISO start of the current user's running timer on this task, or null. */
  runningSince: string | null;
  byUser: { userId: string; name: string; seconds: number; running: boolean }[];
  now: string;
};

function elapsed(entry: { startedAt: Date; endedAt: Date | null; seconds: number }, now: Date) {
  return entry.endedAt ? entry.seconds : Math.max(0, Math.floor((now.getTime() - entry.startedAt.getTime()) / 1000));
}

async function summarise(taskId: string, userId: string): Promise<TaskTime> {
  const now = new Date();
  const entries = await prisma.timeEntry.findMany({
    where: { taskId },
    select: { userId: true, startedAt: true, endedAt: true, seconds: true, user: { select: { name: true } } },
  });
  const byUser = new Map<string, { userId: string; name: string; seconds: number; running: boolean }>();
  let runningSince: string | null = null;
  for (const e of entries) {
    const row = byUser.get(e.userId) ?? { userId: e.userId, name: e.user.name, seconds: 0, running: false };
    row.seconds += elapsed(e, now);
    if (!e.endedAt) {
      row.running = true;
      if (e.userId === userId) runningSince = e.startedAt.toISOString();
    }
    byUser.set(e.userId, row);
  }
  const rows = [...byUser.values()].sort((a, b) => b.seconds - a.seconds);
  return {
    totalSeconds: rows.reduce((s, r) => s + r.seconds, 0),
    mySeconds: byUser.get(userId)?.seconds ?? 0,
    runningSince,
    byUser: rows,
    now: now.toISOString(),
  };
}

export async function getTaskTime(taskId: string) {
  return runAction(async () => {
    const { user } = await requireTaskAccess(taskId, "canView");
    return summarise(taskId, user.id);
  });
}

/** Starts the current user's timer on this task (stopping any other timer they had running). */
export async function startTimer(taskId: string) {
  return runAction(async () => {
    const { user } = await requireTaskAccess(taskId, "canUpdateProgress");
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true, title: true, projectId: true, status: true } });
    if (!task) throw new ActionError("Task not found.");
    if (task.status === "COMPLETED" || task.status === "CANCELLED") throw new ActionError("This task is closed; reopen it to track time.");

    await prisma.$transaction(async (tx) => {
      const now = new Date();
      const running = await tx.timeEntry.findMany({ where: { userId: user.id, endedAt: null } });
      for (const r of running) {
        await tx.timeEntry.update({ where: { id: r.id }, data: { endedAt: now, seconds: elapsed(r, now) } });
      }
      if (running.some((r) => r.taskId === taskId)) return;
      await tx.timeEntry.create({ data: { taskId, userId: user.id, startedAt: now } });
      await logActivity(
        { actorId: user.id, action: "TIMER_STARTED", entity: "Task", entityId: taskId, taskId, projectId: task.projectId, details: { title: task.title } },
        tx,
      );
    });
    revalidatePath(`/tasks/${taskId}`);
    revalidatePath(`/my-tasks/${taskId}`);
    return summarise(taskId, user.id);
  });
}

export async function stopTimer(taskId: string) {
  return runAction(async () => {
    const { user } = await requireTaskAccess(taskId, "canUpdateProgress");
    const now = new Date();
    const running = await prisma.timeEntry.findFirst({ where: { taskId, userId: user.id, endedAt: null } });
    if (running) {
      const seconds = elapsed(running, now);
      await prisma.$transaction(async (tx) => {
        await tx.timeEntry.update({ where: { id: running.id }, data: { endedAt: now, seconds } });
        const task = await tx.task.findUnique({ where: { id: taskId }, select: { title: true, projectId: true } });
        await logActivity(
          {
            actorId: user.id,
            action: "TIMER_STOPPED",
            entity: "Task",
            entityId: taskId,
            taskId,
            projectId: task?.projectId ?? null,
            details: { title: task?.title, seconds },
          },
          tx,
        );
      });
    }
    revalidatePath(`/tasks/${taskId}`);
    revalidatePath(`/my-tasks/${taskId}`);
    return summarise(taskId, user.id);
  });
}
