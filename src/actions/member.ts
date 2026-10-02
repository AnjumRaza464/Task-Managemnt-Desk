"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth-guard";
import { ActionError, runAction } from "@/lib/action-result";
import { logActivity, notifyManagers } from "@/lib/activity";
import { progressForCompletionChange, progressForStatusChange } from "@/lib/task-progress";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Self-service actions for the signed-in assignee of a task. Members may move
 * their own tasks between Pending / In progress / Completed and set the
 * completion percentage. Everything else stays manager-only.
 */

const MEMBER_STATUS = z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]);
const statusSchema = z.object({ id: z.string().min(1), status: MEMBER_STATUS });
const completionSchema = z.object({ id: z.string().min(1), completion: z.coerce.number().int().min(0).max(100) });

function revalidateAll(taskId: string) {
  const paths = [
    "/my-tasks",
    `/my-tasks/${taskId}`,
    `/tasks/${taskId}`,
    "/dashboard",
    "/tasks",
    "/tasks/kanban",
    "/calendar",
    "/monthly-plans",
    "/reports",
    "/users",
    "/notifications",
  ];
  for (const p of paths) revalidatePath(p);
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError("Please sign in again.");
  return user;
}

/** Loads the task and verifies the current user is its assignee. */
async function loadOwnTask(tx: Prisma.TransactionClient, id: string, userId: string) {
  const task = await tx.task.findUnique({ where: { id } });
  if (!task) throw new ActionError("Task not found.");
  if (task.assigneeId !== userId) throw new UnauthorizedError("You can only update tasks assigned to you.");
  if (task.status === "CANCELLED") throw new ActionError("This task was cancelled by a manager and cannot be updated.");
  return task;
}

export async function updateMyTaskStatus(input: unknown) {
  return runAction(async () => {
    const user = await requireUser();
    const { id, status } = statusSchema.parse(input);

    const task = await prisma.$transaction(async (tx) => {
      const existing = await loadOwnTask(tx, id, user.id);
      const progress = progressForStatusChange(existing, status);
      const updated = await tx.task.update({
        where: { id },
        data: {
          status: progress.status,
          completion: progress.completion,
          ...(progress.completedAt !== undefined ? { completedAt: progress.completedAt } : {}),
        },
      });
      if (existing.status !== updated.status) {
        await logActivity(
          {
            actorId: user.id,
            action: "STATUS_CHANGED",
            entity: "Task",
            entityId: id,
            taskId: id,
            details: { title: updated.title, from: existing.status, to: updated.status, by: "assignee" },
          },
          tx,
        );
        if (updated.status === "COMPLETED") {
          await notifyManagers(
            {
              type: "TASK_COMPLETED",
              title: "Task completed",
              message: `${user.name} marked "${updated.title}" as completed.`,
              taskId: id,
            },
            tx,
          );
        }
      }
      return updated;
    });

    revalidateAll(task.id);
    return { status: task.status, completion: task.completion };
  });
}

export async function updateMyTaskCompletion(input: unknown) {
  return runAction(async () => {
    const user = await requireUser();
    const { id, completion } = completionSchema.parse(input);

    const task = await prisma.$transaction(async (tx) => {
      const existing = await loadOwnTask(tx, id, user.id);
      const progress = progressForCompletionChange(existing, completion);
      const updated = await tx.task.update({
        where: { id },
        data: {
          status: progress.status,
          completion: progress.completion,
          ...(progress.completedAt !== undefined ? { completedAt: progress.completedAt } : {}),
        },
      });
      await logActivity(
        {
          actorId: user.id,
          action: "PROGRESS_UPDATED",
          entity: "Task",
          entityId: id,
          taskId: id,
          details: { title: updated.title, from: existing.completion, to: updated.completion, by: "assignee" },
        },
        tx,
      );
      if (existing.status !== "COMPLETED" && updated.status === "COMPLETED") {
        await notifyManagers(
          {
            type: "TASK_COMPLETED",
            title: "Task completed",
            message: `${user.name} brought "${updated.title}" to 100%.`,
            taskId: id,
          },
          tx,
        );
      }
      return updated;
    });

    revalidateAll(task.id);
    return { status: task.status, completion: task.completion };
  });
}
