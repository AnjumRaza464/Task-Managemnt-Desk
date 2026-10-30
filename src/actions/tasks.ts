"use server";

import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { UnauthorizedError, type CurrentUser } from "@/lib/auth-guard";
import { ActionError, runAction } from "@/lib/action-result";
import { logActivity, notifyManagers, notifyUsers } from "@/lib/activity";
import { assertActiveUsers, assigneeNames, syncTaskAssignees } from "@/lib/assignees";
import { parseDateInput } from "@/lib/dates";
import { getProjectAccess, requireTaskAccess, requireUser } from "@/lib/permissions";
import { ensureProjectMembers, resolveProjectPlacement, revalidateProjectViews } from "@/lib/project-members";
import { revalidateTaskViews } from "@/lib/task-views";
import { resolvePlan } from "@/lib/recurrence";
import { assertNotBlocked, onTaskCompleted } from "@/lib/task-events";
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

/**
 * Who may create a task: managers anywhere, project members inside their
 * project. Members must pick a project.
 */
async function requireTaskCreator(projectId: string | null): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "MEMBER") return user;
  if (!projectId) throw new UnauthorizedError("Pick a project you belong to; only managers can create tasks outside a project.");
  const access = await getProjectAccess(user, projectId);
  if (!access?.canEdit) throw new UnauthorizedError("You need to be a member of that project to add tasks.");
  return user;
}

/** Members may only assign people who are in the project; managers may assign anyone (they are added to the project). */
async function assertAssigneesAllowed(user: CurrentUser, projectId: string | null, assigneeIds: string[]) {
  if (user.role !== "MEMBER" || !projectId) return;
  const members = await prisma.projectMember.findMany({ where: { projectId, userId: { in: assigneeIds } }, select: { userId: true } });
  if (members.length !== new Set(assigneeIds).size) throw new ActionError("You can only assign people who are members of this project.");
}

async function placement(tx: Tx, values: { projectId: string | null; listId: string | null; milestoneId: string | null }) {
  try {
    return await resolveProjectPlacement(tx, values);
  } catch (e) {
    throw new ActionError(e instanceof Error ? e.message : "Invalid project.");
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
    const values = taskSchema.parse(input);
    const manager = await requireTaskCreator(values.projectId);
    await assertAssigneesAllowed(manager, values.projectId, values.assigneeIds);
    const dueDate = parseDateInput(values.dueDate);
    const startDate = values.startDate ? parseDateInput(values.startDate) : null;
    const recurrenceEndsAt = values.recurrence !== "NONE" && values.recurrenceEndsAt ? parseDateInput(values.recurrenceEndsAt) : null;

    const task = await prisma.$transaction(async (tx) => {
      const assignees = await assertActiveUsers(tx, values.assigneeIds);
      const primary = assignees[0];
      const plan = await resolvePlan(tx, primary.id, dueDate);
      const progress = normalizeProgress(values.status, values.completion, dueDate);
      const where = await placement(tx, values);
      const lastPosition = await tx.task.aggregate({
        _max: { position: true },
        where: where.projectId ? { projectId: where.projectId, listId: where.listId } : { status: progress.status },
      });

      const created = await tx.task.create({
        data: {
          title: values.title,
          description: values.description,
          planId: plan.id,
          assigneeId: primary.id,
          createdById: manager.id,
          categoryId: values.categoryId,
          projectId: where.projectId,
          listId: where.listId,
          milestoneId: where.milestoneId,
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

      if (where.project) await ensureProjectMembers(tx, where.project, assignees.map((a) => a.id), manager.id);
      await logActivity(
        {
          actorId: manager.id,
          action: "TASK_CREATED",
          entity: "Task",
          entityId: created.id,
          taskId: created.id,
          projectId: where.projectId,
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

    revalidateTaskViews(task.id);
    if (task.projectId) revalidateProjectViews(task.projectId);
    return { id: task.id };
  });
}

export async function updateTask(id: string, input: unknown) {
  return runAction(async () => {
    const values = taskSchema.parse(input);
    const { user: manager } = await requireTaskAccess(id, "canManage");
    if (values.projectId && manager.role === "MEMBER") {
      const access = await getProjectAccess(manager, values.projectId);
      if (!access?.canManage) throw new UnauthorizedError("You cannot move the task into that project.");
    }
    await assertAssigneesAllowed(manager, values.projectId, values.assigneeIds);
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
      if (progress.status === "COMPLETED" && existing.status !== "COMPLETED") await assertNotBlocked(tx, id);
      const where = await placement(tx, values);

      const updated = await tx.task.update({
        where: { id },
        data: {
          title: values.title,
          description: values.description,
          planId: plan.id,
          assigneeId: primary.id,
          categoryId: values.categoryId,
          projectId: where.projectId,
          listId: where.listId,
          milestoneId: where.milestoneId,
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
      if (where.project) await ensureProjectMembers(tx, where.project, assignees.map((a) => a.id), manager.id);
      const before = currentAssignees(existing);
      const assigneesChanged = added.length > 0 || before.length !== assignees.length;

      const changes: Record<string, unknown> = {};
      if (existing.status !== updated.status) changes.status = { from: existing.status, to: updated.status };
      if (existing.priority !== updated.priority) changes.priority = { from: existing.priority, to: updated.priority };
      if (assigneesChanged) changes.assignee = { from: assigneeNames(before), to: assigneeNames(assignees) };
      if (existing.completion !== updated.completion) changes.completion = { from: existing.completion, to: updated.completion };
      if (existing.dueDate.getTime() !== updated.dueDate.getTime()) changes.dueDate = { from: existing.dueDate, to: updated.dueDate };
      if (existing.recurrence !== updated.recurrence) changes.recurrence = { from: existing.recurrence, to: updated.recurrence };
      if (existing.projectId !== updated.projectId) changes.project = { from: existing.projectId, to: updated.projectId };

      await logActivity(
        {
          actorId: manager.id,
          action: assigneesChanged ? "TASK_REASSIGNED" : "TASK_UPDATED",
          entity: "Task",
          entityId: id,
          taskId: id,
          projectId: updated.projectId,
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
        await onTaskCompleted(tx, updated, manager.id);
      }
      return { updated, previousProjectId: existing.projectId };
    });

    revalidateTaskViews(task.updated.id);
    if (task.updated.projectId) revalidateProjectViews(task.updated.projectId);
    if (task.previousProjectId && task.previousProjectId !== task.updated.projectId) revalidateProjectViews(task.previousProjectId);
    return { id: task.updated.id };
  });
}

export async function updateTaskStatus(input: unknown) {
  return runAction(async () => {
    const { id, status } = taskStatusUpdateSchema.parse(input);
    const { user: manager } = await requireTaskAccess(id, "canUpdateProgress");

    const task = await prisma.$transaction(async (tx) => {
      const existing = await tx.task.findUnique({ where: { id }, include: assigneeInclude });
      if (!existing) throw new ActionError("Task not found.");
      const progress = progressForStatusChange(existing, status);
      if (progress.status === "COMPLETED" && existing.status !== "COMPLETED") await assertNotBlocked(tx, id);
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
          await onTaskCompleted(tx, updated, manager.id);
        }
      }
      return updated;
    });

    revalidateTaskViews(task.id);
    if (task.projectId) revalidateProjectViews(task.projectId);
    return { status: task.status, completion: task.completion };
  });
}

export async function updateTaskCompletion(input: unknown) {
  return runAction(async () => {
    const { id, completion } = taskCompletionSchema.parse(input);
    const { user: manager } = await requireTaskAccess(id, "canUpdateProgress");

    const task = await prisma.$transaction(async (tx) => {
      const existing = await tx.task.findUnique({ where: { id }, include: assigneeInclude });
      if (!existing) throw new ActionError("Task not found.");
      const progress = progressForCompletionChange(existing, completion);
      if (progress.status === "COMPLETED" && existing.status !== "COMPLETED") await assertNotBlocked(tx, id);
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
        await onTaskCompleted(tx, updated, manager.id);
      }
      return updated;
    });

    revalidateTaskViews(task.id);
    if (task.projectId) revalidateProjectViews(task.projectId);
    return { status: task.status, completion: task.completion };
  });
}

/** Replaces the full set of assignees; the first id becomes the primary assignee. */
export async function setTaskAssignees(input: unknown) {
  return runAction(async () => {
    const { id, assigneeIds } = assigneesSchema.parse(input);
    const { user: manager, task: t } = await requireTaskAccess(id, "canManage");
    await assertAssigneesAllowed(manager, t.projectId, assigneeIds);
    const task = await prisma.$transaction(async (tx) => applyAssignees(tx, id, assigneeIds, manager.id));
    revalidateTaskViews(task.id);
    if (task.projectId) revalidateProjectViews(task.projectId);
    return { id: task.id, assigneeIds };
  });
}

/** Adds or removes one person without touching the rest. */
export async function toggleTaskAssignee(input: unknown) {
  return runAction(async () => {
    const { id, userId, assigned } = toggleAssigneeSchema.parse(input);
    const { user: manager, task: t } = await requireTaskAccess(id, "canManage");
    if (assigned) await assertAssigneesAllowed(manager, t.projectId, [userId]);
    const task = await prisma.$transaction(async (tx) => {
      const current = await tx.taskAssignee.findMany({ where: { taskId: id }, orderBy: { createdAt: "asc" }, select: { userId: true } });
      const ids = current.map((a) => a.userId);
      const next = assigned ? [...ids.filter((u) => u !== userId), userId] : ids.filter((u) => u !== userId);
      if (next.length === 0) throw new ActionError("A task needs at least one assignee.");
      return applyAssignees(tx, id, next, manager.id);
    });
    revalidateTaskViews(task.id);
    if (task.projectId) revalidateProjectViews(task.projectId);
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
  const updated = await tx.task.update({
    where: { id },
    data: { assigneeId: primaryId, planId: plan.id },
    include: { project: { select: { id: true, name: true } } },
  });
  const { added, removed } = await syncTaskAssignees(tx, id, assigneeIds, actorId);
  if (added.length === 0 && removed.length === 0) return updated;
  if (updated.project) await ensureProjectMembers(tx, updated.project, added, actorId);

  await logActivity(
    {
      actorId,
      action: "TASK_REASSIGNED",
      entity: "Task",
      entityId: id,
      taskId: id,
      projectId: updated.projectId,
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
    const { user: manager } = await requireTaskAccess(id, "canManage");
    const task = await prisma.task.findUnique({ where: { id }, select: { id: true, title: true, projectId: true } });
    if (!task) throw new ActionError("Task not found.");
    await prisma.$transaction(async (tx) => {
      await tx.task.delete({ where: { id } });
      await logActivity(
        { actorId: manager.id, action: "TASK_DELETED", entity: "Task", entityId: id, projectId: task.projectId, details: { title: task.title } },
        tx,
      );
    });
    revalidateTaskViews();
    if (task.projectId) revalidateProjectViews(task.projectId);
    return undefined;
  });
}
