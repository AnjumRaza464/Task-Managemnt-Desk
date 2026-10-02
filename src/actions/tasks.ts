"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth-guard";
import { ActionError, runAction } from "@/lib/action-result";
import { logActivity, notifyManagers } from "@/lib/activity";
import { parseDateInput } from "@/lib/dates";
import { normalizeProgress, progressForCompletionChange, progressForStatusChange } from "@/lib/task-progress";
import {
  reassignSchema,
  taskCompletionSchema,
  taskSchema,
  taskStatusUpdateSchema,
} from "@/lib/validations/task";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export async function revalidateTaskViews(taskId?: string) {
  const paths = ["/dashboard", "/tasks", "/tasks/kanban", "/calendar", "/monthly-plans", "/reports", "/users", "/notifications"];
  for (const p of paths) revalidatePath(p);
  if (taskId) revalidatePath(`/tasks/${taskId}`);
}

/** Finds or creates the (user, year, month) plan a task belongs to. */
async function resolvePlan(tx: Tx, assigneeId: string, dueDate: Date) {
  const year = dueDate.getFullYear();
  const month = dueDate.getMonth() + 1;
  return tx.monthlyPlan.upsert({
    where: { userId_year_month: { userId: assigneeId, year, month } },
    update: {},
    create: { userId: assigneeId, year, month },
  });
}

async function assertActiveUser(tx: Tx, userId: string) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, name: true, isActive: true } });
  if (!user) throw new ActionError("Assigned user not found.");
  if (!user.isActive) throw new ActionError("Cannot assign tasks to an inactive user.");
  return user;
}

export async function createTask(input: unknown) {
  return runAction(async () => {
    const manager = await requireManager();
    const values = taskSchema.parse(input);
    const dueDate = parseDateInput(values.dueDate);
    const startDate = values.startDate ? parseDateInput(values.startDate) : null;

    const task = await prisma.$transaction(async (tx) => {
      const assignee = await assertActiveUser(tx, values.assigneeId);
      const plan = await resolvePlan(tx, values.assigneeId, dueDate);
      const progress = normalizeProgress(values.status, values.completion, dueDate);
      const lastPosition = await tx.task.aggregate({ _max: { position: true }, where: { status: progress.status } });

      const created = await tx.task.create({
        data: {
          title: values.title,
          description: values.description,
          planId: plan.id,
          assigneeId: values.assigneeId,
          createdById: manager.id,
          categoryId: values.categoryId,
          priority: values.priority,
          status: progress.status,
          completion: progress.completion,
          completedAt: progress.completedAt ?? null,
          startDate,
          dueDate,
          position: (lastPosition._max.position ?? 0) + 1,
        },
      });

      await logActivity(
        {
          actorId: manager.id,
          action: "TASK_CREATED",
          entity: "Task",
          entityId: created.id,
          taskId: created.id,
          details: { title: created.title, assignee: assignee.name },
        },
        tx,
      );
      await notifyManagers(
        {
          type: "TASK_ASSIGNED",
          title: "Task assigned",
          message: `"${created.title}" was assigned to ${assignee.name}.`,
          taskId: created.id,
          excludeUserId: manager.id,
        },
        tx,
      );
      return created;
    });

    await revalidateTaskViews(task.id);
    return { id: task.id };
  });
}

export async function updateTask(id: string, input: unknown) {
  return runAction(async () => {
    const manager = await requireManager();
    const values = taskSchema.parse(input);
    const dueDate = parseDateInput(values.dueDate);
    const startDate = values.startDate ? parseDateInput(values.startDate) : null;

    const task = await prisma.$transaction(async (tx) => {
      const existing = await tx.task.findUnique({ where: { id }, include: { assignee: true } });
      if (!existing) throw new ActionError("Task not found.");

      const assignee = await assertActiveUser(tx, values.assigneeId);
      const plan = await resolvePlan(tx, values.assigneeId, dueDate);
      const progress = normalizeProgress(values.status, values.completion, dueDate, existing.status);

      const updated = await tx.task.update({
        where: { id },
        data: {
          title: values.title,
          description: values.description,
          planId: plan.id,
          assigneeId: values.assigneeId,
          categoryId: values.categoryId,
          priority: values.priority,
          status: progress.status,
          completion: progress.completion,
          ...(progress.completedAt !== undefined ? { completedAt: progress.completedAt } : {}),
          startDate,
          dueDate,
        },
      });

      const changes: Record<string, unknown> = {};
      if (existing.status !== updated.status) changes.status = { from: existing.status, to: updated.status };
      if (existing.priority !== updated.priority) changes.priority = { from: existing.priority, to: updated.priority };
      if (existing.assigneeId !== updated.assigneeId) changes.assignee = { from: existing.assignee.name, to: assignee.name };
      if (existing.completion !== updated.completion) changes.completion = { from: existing.completion, to: updated.completion };
      if (existing.dueDate.getTime() !== updated.dueDate.getTime()) changes.dueDate = { from: existing.dueDate, to: updated.dueDate };

      await logActivity(
        {
          actorId: manager.id,
          action: existing.assigneeId !== updated.assigneeId ? "TASK_REASSIGNED" : "TASK_UPDATED",
          entity: "Task",
          entityId: id,
          taskId: id,
          details: { title: updated.title, changes } as Prisma.InputJsonValue,
        },
        tx,
      );

      if (existing.status !== "COMPLETED" && updated.status === "COMPLETED") {
        await notifyManagers(
          {
            type: "TASK_COMPLETED",
            title: "Task completed",
            message: `"${updated.title}" (${assignee.name}) was marked completed.`,
            taskId: id,
            dedupeKey: `COMPLETED:${id}:${Date.now()}`,
          },
          tx,
        );
      }
      return updated;
    });

    await revalidateTaskViews(task.id);
    return { id: task.id };
  });
}

export async function updateTaskStatus(input: unknown) {
  return runAction(async () => {
    const manager = await requireManager();
    const { id, status } = taskStatusUpdateSchema.parse(input);

    const task = await prisma.$transaction(async (tx) => {
      const existing = await tx.task.findUnique({ where: { id }, include: { assignee: { select: { name: true } } } });
      if (!existing) throw new ActionError("Task not found.");
      const progress = progressForStatusChange(existing, status);
      const lastPosition = await tx.task.aggregate({ _max: { position: true }, where: { status: progress.status } });
      const updated = await tx.task.update({
        where: { id },
        data: {
          status: progress.status,
          completion: progress.completion,
          ...(progress.completedAt !== undefined ? { completedAt: progress.completedAt } : {}),
          position: (lastPosition._max.position ?? 0) + 1,
        },
      });
      if (existing.status !== updated.status) {
        await logActivity(
          {
            actorId: manager.id,
            action: "STATUS_CHANGED",
            entity: "Task",
            entityId: id,
            taskId: id,
            details: { title: updated.title, from: existing.status, to: updated.status },
          },
          tx,
        );
        if (updated.status === "COMPLETED") {
          await notifyManagers(
            {
              type: "TASK_COMPLETED",
              title: "Task completed",
              message: `"${updated.title}" (${existing.assignee.name}) was marked completed.`,
              taskId: id,
            },
            tx,
          );
        }
      }
      return updated;
    });

    await revalidateTaskViews(task.id);
    return { status: task.status, completion: task.completion };
  });
}

export async function updateTaskCompletion(input: unknown) {
  return runAction(async () => {
    const manager = await requireManager();
    const { id, completion } = taskCompletionSchema.parse(input);

    const task = await prisma.$transaction(async (tx) => {
      const existing = await tx.task.findUnique({ where: { id }, include: { assignee: { select: { name: true } } } });
      if (!existing) throw new ActionError("Task not found.");
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
          actorId: manager.id,
          action: "PROGRESS_UPDATED",
          entity: "Task",
          entityId: id,
          taskId: id,
          details: { title: updated.title, from: existing.completion, to: updated.completion },
        },
        tx,
      );
      if (existing.status !== "COMPLETED" && updated.status === "COMPLETED") {
        await notifyManagers(
          {
            type: "TASK_COMPLETED",
            title: "Task completed",
            message: `"${updated.title}" (${existing.assignee.name}) reached 100%.`,
            taskId: id,
          },
          tx,
        );
      }
      return updated;
    });

    await revalidateTaskViews(task.id);
    return { status: task.status, completion: task.completion };
  });
}

export async function reassignTask(input: unknown) {
  return runAction(async () => {
    const manager = await requireManager();
    const { id, assigneeId } = reassignSchema.parse(input);

    const task = await prisma.$transaction(async (tx) => {
      const existing = await tx.task.findUnique({ where: { id }, include: { assignee: true } });
      if (!existing) throw new ActionError("Task not found.");
      if (existing.assigneeId === assigneeId) return existing;
      const assignee = await assertActiveUser(tx, assigneeId);
      const plan = await resolvePlan(tx, assigneeId, existing.dueDate);
      const updated = await tx.task.update({ where: { id }, data: { assigneeId, planId: plan.id } });
      await logActivity(
        {
          actorId: manager.id,
          action: "TASK_REASSIGNED",
          entity: "Task",
          entityId: id,
          taskId: id,
          details: { title: updated.title, from: existing.assignee.name, to: assignee.name },
        },
        tx,
      );
      await notifyManagers(
        {
          type: "TASK_ASSIGNED",
          title: "Task reassigned",
          message: `"${updated.title}" moved from ${existing.assignee.name} to ${assignee.name}.`,
          taskId: id,
          excludeUserId: manager.id,
        },
        tx,
      );
      return updated;
    });

    await revalidateTaskViews(task.id);
    return { id: task.id };
  });
}

export async function deleteTask(id: string) {
  return runAction(async () => {
    const manager = await requireManager();
    const task = await prisma.task.findUnique({ where: { id }, select: { id: true, title: true } });
    if (!task) throw new ActionError("Task not found.");
    await prisma.$transaction(async (tx) => {
      await tx.task.delete({ where: { id } });
      await logActivity(
        { actorId: manager.id, action: "TASK_DELETED", entity: "Task", entityId: id, details: { title: task.title } },
        tx,
      );
    });
    await revalidateTaskViews();
    return undefined;
  });
}
