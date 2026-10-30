"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth-guard";
import { ActionError, runAction } from "@/lib/action-result";
import { logActivity, notifyManagers, notifyUsers } from "@/lib/activity";
import { assertActiveUsers, assigneeNames, syncTaskAssignees } from "@/lib/assignees";
import { parseDateInput } from "@/lib/dates";
import { resolvePlan, spawnNextOccurrence } from "@/lib/recurrence";
import { normalizeProgress, progressForCompletionChange, progressForStatusChange } from "@/lib/task-progress";
import {
  assigneesSchema,
  taskCompletionSchema,
  taskSchema,
  taskStatusUpdateSchema,
  toggleAssigneeSchema,
} from "@/lib/validations/task";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export async function revalidateTaskViews(taskId?: string) {
  const paths = ["/dashboard", "/tasks", "/tasks/kanban", "/calendar", "/monthly-plans", "/reports", "/users", "/notifications", "/my-tasks"];
  for (const p of paths) revalidatePath(p);
  if (taskId) {
    revalidatePath(`/tasks/${taskId}`);
    revalidatePath(`/my-tasks/${taskId}`);
  }
}

const assigneeInclude = { assignees: { select: { userId: true, user: { select: { id: true, name: true } } } } } satisfies Prisma.TaskInclude;

type TaskWithAssignees = Prisma.TaskGetPayload<{ include: typeof assigneeInclude }>;

function currentAssignees(task: TaskWithAssignees) {
  return task.assignees.map((a) => a.user);
}

/** Tells every assignee (except the actor) that the task was assigned to them. */
async function notifyAssigned(tx: Tx, task: { id: string; title: string; dueDate: Date }, userIds: string[], actorId: string, reassigned = false) {
  await notifyUsers(
    {
      userIds,
      type: "TASK_ASSIGNED",
      title: reassigned ? "Task assigned to you" : "New task assigned to you",
      message: `"${task.title}" is ${reassigned ? "now assigned to you · " : ""}due ${format(task.dueDate, "MMM d")}.`,
      taskId: task.id,
      excludeUserId: actorId,
    },
    tx,
  );
}

export async function createTask(input: unknown) {
  return runAction(async () => {
    const manager = await requireManager();
    const values = taskSchema.parse(input);
    const dueDate = parseDateInput(values.dueDate);
    const startDate = values.startDate ? parseDateInput(values.startDate) : null;
    const recurrenceEndsAt = values.recurrence !== "NONE" && values.recurrenceEndsAt ? parseDateInput(values.recurrenceEndsAt) : null;

    const task = await prisma.$transaction(async (tx) => {
      const assignees = await assertActiveUsers(tx, values.assigneeIds);
      const primary = assignees[0];
      const plan = await resolvePlan(tx, primary.id, dueDate);
      const progress = normalizeProgress(values.status, values.completion, dueDate);
      const lastPosition = await tx.task.aggregate({ _max: { position: true }, where: { status: progress.status } });

      const created = await tx.task.create({
        data: {
          title: values.title,
          description: values.description,
          planId: plan.id,
          assigneeId: primary.id,
          createdById: manager.id,
          categoryId: values.categoryId,
          priority: values.priority,
          status: progress.status,
          completion: progress.completion,
          completedAt: progress.completedAt ?? null,
          startDate,
          dueDate,
          position: (lastPosition._max.position ?? 0) + 1,
          recurrence: values.recurrence,
          recurrenceEndsAt,
          assignees: { create: assignees.map((a) => ({ userId: a.id, assignedById: manager.id })) },
        },
      });

      await logActivity(
        {
          actorId: manager.id,
          action: "TASK_CREATED",
          entity: "Task",
          entityId: created.id,
          taskId: created.id,
          details: { title: created.title, assignee: assigneeNames(assignees), assignees: assignees.map((a) => a.name) },
        },
        tx,
      );
      await notifyManagers(
        {
          type: "TASK_ASSIGNED",
          title: "Task assigned",
          message: `"${created.title}" was assigned to ${assigneeNames(assignees)}.`,
          taskId: created.id,
          excludeUserIds: [manager.id, ...assignees.map((a) => a.id)],
        },
        tx,
      );
      await notifyAssigned(tx, created, assignees.map((a) => a.id), manager.id);
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
    const recurrenceEndsAt = values.recurrence !== "NONE" && values.recurrenceEndsAt ? parseDateInput(values.recurrenceEndsAt) : null;

    const task = await prisma.$transaction(async (tx) => {
      const existing = await tx.task.findUnique({ where: { id }, include: assigneeInclude });
      if (!existing) throw new ActionError("Task not found.");

      const assignees = await assertActiveUsers(tx, values.assigneeIds);
      const primary = assignees[0];
      const plan = await resolvePlan(tx, primary.id, dueDate);
      const progress = normalizeProgress(values.status, values.completion, dueDate, existing.status);

      const updated = await tx.task.update({
        where: { id },
        data: {
          title: values.title,
          description: values.description,
          planId: plan.id,
          assigneeId: primary.id,
          categoryId: values.categoryId,
          priority: values.priority,
          status: progress.status,
          completion: progress.completion,
          ...(progress.completedAt !== undefined ? { completedAt: progress.completedAt } : {}),
          startDate,
          dueDate,
          recurrence: values.recurrence,
          recurrenceEndsAt,
        },
      });
      const { added } = await syncTaskAssignees(tx, id, values.assigneeIds, manager.id);
      const before = currentAssignees(existing);
      const assigneesChanged = added.length > 0 || before.length !== assignees.length;

      const changes: Record<string, unknown> = {};
      if (existing.status !== updated.status) changes.status = { from: existing.status, to: updated.status };
      if (existing.priority !== updated.priority) changes.priority = { from: existing.priority, to: updated.priority };
      if (assigneesChanged) changes.assignee = { from: assigneeNames(before), to: assigneeNames(assignees) };
      if (existing.completion !== updated.completion) changes.completion = { from: existing.completion, to: updated.completion };
      if (existing.dueDate.getTime() !== updated.dueDate.getTime()) changes.dueDate = { from: existing.dueDate, to: updated.dueDate };
      if (existing.recurrence !== updated.recurrence) changes.recurrence = { from: existing.recurrence, to: updated.recurrence };

      await logActivity(
        {
          actorId: manager.id,
          action: assigneesChanged ? "TASK_REASSIGNED" : "TASK_UPDATED",
          entity: "Task",
          entityId: id,
          taskId: id,
          details: { title: updated.title, changes } as Prisma.InputJsonValue,
        },
        tx,
      );

      if (added.length > 0) await notifyAssigned(tx, updated, added, manager.id, true);

      if (existing.status !== "COMPLETED" && updated.status === "COMPLETED") {
        await notifyManagers(
          {
            type: "TASK_COMPLETED",
            title: "Task completed",
            message: `"${updated.title}" (${assigneeNames(assignees)}) was marked completed.`,
            taskId: id,
            excludeUserId: manager.id,
          },
          tx,
        );
        await spawnNextOccurrence(tx, updated, manager.id);
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
      const existing = await tx.task.findUnique({ where: { id }, include: assigneeInclude });
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
              message: `"${updated.title}" (${assigneeNames(currentAssignees(existing))}) was marked completed.`,
              taskId: id,
              excludeUserId: manager.id,
            },
            tx,
          );
          await spawnNextOccurrence(tx, updated, manager.id);
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
      const existing = await tx.task.findUnique({ where: { id }, include: assigneeInclude });
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
            message: `"${updated.title}" (${assigneeNames(currentAssignees(existing))}) reached 100%.`,
            taskId: id,
            excludeUserId: manager.id,
          },
          tx,
        );
        await spawnNextOccurrence(tx, updated, manager.id);
      }
      return updated;
    });

    await revalidateTaskViews(task.id);
    return { status: task.status, completion: task.completion };
  });
}

/** Replaces the full set of assignees; the first id becomes the primary assignee. */
export async function setTaskAssignees(input: unknown) {
  return runAction(async () => {
    const manager = await requireManager();
    const { id, assigneeIds } = assigneesSchema.parse(input);
    const task = await prisma.$transaction(async (tx) => applyAssignees(tx, id, assigneeIds, manager.id));
    await revalidateTaskViews(task.id);
    return { id: task.id, assigneeIds };
  });
}

/** Adds or removes one person without touching the rest. */
export async function toggleTaskAssignee(input: unknown) {
  return runAction(async () => {
    const manager = await requireManager();
    const { id, userId, assigned } = toggleAssigneeSchema.parse(input);
    const task = await prisma.$transaction(async (tx) => {
      const current = await tx.taskAssignee.findMany({ where: { taskId: id }, orderBy: { createdAt: "asc" }, select: { userId: true } });
      const ids = current.map((a) => a.userId);
      const next = assigned ? [...ids.filter((u) => u !== userId), userId] : ids.filter((u) => u !== userId);
      if (next.length === 0) throw new ActionError("A task needs at least one assignee.");
      return applyAssignees(tx, id, next, manager.id);
    });
    await revalidateTaskViews(task.id);
    return { id: task.id };
  });
}

async function applyAssignees(tx: Tx, id: string, assigneeIds: string[], actorId: string) {
  const existing = await tx.task.findUnique({ where: { id }, include: assigneeInclude });
  if (!existing) throw new ActionError("Task not found.");
  const assignees = await assertActiveUsers(tx, assigneeIds);
  const before = currentAssignees(existing);

  // Keep the current primary assignee when they are still assigned, so the task stays in their plan.
  const primaryId = assigneeIds.includes(existing.assigneeId) ? existing.assigneeId : assigneeIds[0];
  const plan = await resolvePlan(tx, primaryId, existing.dueDate);
  const updated = await tx.task.update({ where: { id }, data: { assigneeId: primaryId, planId: plan.id } });
  const { added, removed } = await syncTaskAssignees(tx, id, assigneeIds, actorId);
  if (added.length === 0 && removed.length === 0) return updated;

  await logActivity(
    {
      actorId,
      action: "TASK_REASSIGNED",
      entity: "Task",
      entityId: id,
      taskId: id,
      details: { title: updated.title, from: assigneeNames(before), to: assigneeNames(assignees) },
    },
    tx,
  );
  await notifyManagers(
    {
      type: "TASK_ASSIGNED",
      title: "Task reassigned",
      message: `"${updated.title}" is now assigned to ${assigneeNames(assignees)}.`,
      taskId: id,
      excludeUserIds: [actorId, ...assigneeIds],
    },
    tx,
  );
  if (added.length > 0) await notifyAssigned(tx, updated, added, actorId, true);
  return updated;
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
