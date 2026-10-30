"use server";

import { prisma } from "@/lib/prisma";
import { ActionError, runAction } from "@/lib/action-result";
import { logActivity } from "@/lib/activity";
import { requireProjectAccess, requireTaskAccess } from "@/lib/permissions";
import { listSchema, listUpdateSchema, moveTaskSchema, reorderListsSchema } from "@/lib/validations/project";
import { revalidateProjectViews as revalidateProject } from "@/lib/project-members";
import { revalidateTaskViews } from "@/lib/task-views";

export async function createList(input: unknown) {
  return runAction(async () => {
    const values = listSchema.parse(input);
    const { user } = await requireProjectAccess(values.projectId, "manage");
    const last = await prisma.list.aggregate({ _max: { position: true }, where: { projectId: values.projectId } });
    const list = await prisma.list.create({
      data: { projectId: values.projectId, name: values.name, position: (last._max.position ?? 0) + 1 },
    });
    await logActivity({
      actorId: user.id,
      action: "LIST_CREATED",
      entity: "List",
      entityId: list.id,
      projectId: values.projectId,
      details: { name: list.name },
    });
    await revalidateProject(values.projectId);
    return { id: list.id };
  });
}

export async function renameList(input: unknown) {
  return runAction(async () => {
    const values = listUpdateSchema.parse(input);
    const existing = await prisma.list.findUnique({ where: { id: values.id } });
    if (!existing) throw new ActionError("List not found.");
    const { user } = await requireProjectAccess(existing.projectId, "manage");
    const list = await prisma.list.update({ where: { id: values.id }, data: { name: values.name } });
    await logActivity({
      actorId: user.id,
      action: "LIST_RENAMED",
      entity: "List",
      entityId: list.id,
      projectId: list.projectId,
      details: { from: existing.name, to: list.name },
    });
    await revalidateProject(list.projectId);
    return { id: list.id };
  });
}

export async function deleteList(id: string) {
  return runAction(async () => {
    const existing = await prisma.list.findUnique({ where: { id }, include: { _count: { select: { tasks: true } } } });
    if (!existing) throw new ActionError("List not found.");
    const { user } = await requireProjectAccess(existing.projectId, "manage");
    // Tasks are kept and become "unsorted" in the project (listId is set to null by the FK).
    await prisma.list.delete({ where: { id } });
    await logActivity({
      actorId: user.id,
      action: "LIST_DELETED",
      entity: "List",
      entityId: id,
      projectId: existing.projectId,
      details: { name: existing.name, unsortedTasks: existing._count.tasks },
    });
    await revalidateProject(existing.projectId);
    return { unsortedTasks: existing._count.tasks };
  });
}

export async function reorderLists(input: unknown) {
  return runAction(async () => {
    const values = reorderListsSchema.parse(input);
    await requireProjectAccess(values.projectId, "manage");
    await prisma.$transaction(
      values.listIds.map((id, position) => prisma.list.updateMany({ where: { id, projectId: values.projectId }, data: { position } })),
    );
    await revalidateProject(values.projectId);
    return undefined;
  });
}

/** Moves a task to another list (or out of every list) inside its project, at an optional position. */
export async function moveTaskToList(input: unknown) {
  return runAction(async () => {
    const values = moveTaskSchema.parse(input);
    const { user, task } = await requireTaskAccess(values.id, "canEdit");
    if (!task.projectId) throw new ActionError("This task is not part of a project.");
    const projectId = task.projectId;

    const result = await prisma.$transaction(async (tx) => {
      let listName: string | null = null;
      if (values.listId) {
        const list = await tx.list.findUnique({ where: { id: values.listId }, select: { projectId: true, name: true } });
        if (!list || list.projectId !== projectId) throw new ActionError("That list belongs to another project.");
        listName = list.name;
      }
      const before = await tx.task.findUnique({ where: { id: values.id }, select: { listId: true, list: { select: { name: true } }, title: true } });

      // Re-number the target list so the moved task lands at `index` (append by default).
      const siblings = await tx.task.findMany({
        where: { projectId, listId: values.listId, id: { not: values.id } },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      const index = values.index === undefined ? siblings.length : Math.min(values.index, siblings.length);
      const ordered = [...siblings.slice(0, index), { id: values.id }, ...siblings.slice(index)];
      for (const [position, row] of ordered.entries()) {
        await tx.task.update({
          where: { id: row.id },
          data: row.id === values.id ? { listId: values.listId, position } : { position },
        });
      }

      if (before && before.listId !== values.listId) {
        await logActivity(
          {
            actorId: user.id,
            action: "TASK_MOVED",
            entity: "Task",
            entityId: values.id,
            taskId: values.id,
            projectId,
            details: { title: before.title, from: before.list?.name ?? "Unsorted", to: listName ?? "Unsorted" },
          },
          tx,
        );
      }
      return { listId: values.listId };
    });

    await revalidateProject(projectId);
    await revalidateTaskViews(values.id);
    return result;
  });
}
