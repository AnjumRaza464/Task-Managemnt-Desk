"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth-guard";
import { ActionError, runAction } from "@/lib/action-result";
import { logActivity } from "@/lib/activity";
import { subtaskSchema, subtaskUpdateSchema } from "@/lib/validations/task";

export async function createSubtask(input: unknown) {
  return runAction(async () => {
    const manager = await requireManager();
    const values = subtaskSchema.parse(input);
    const last = await prisma.subTask.aggregate({ _max: { position: true }, where: { taskId: values.taskId } });
    const subtask = await prisma.subTask.create({
      data: { taskId: values.taskId, title: values.title, position: (last._max.position ?? 0) + 1 },
    });
    await logActivity({
      actorId: manager.id,
      action: "SUBTASK_ADDED",
      entity: "SubTask",
      entityId: subtask.id,
      taskId: values.taskId,
      details: { title: subtask.title },
    });
    revalidatePath(`/tasks/${values.taskId}`);
    return { id: subtask.id };
  });
}

export async function updateSubtask(input: unknown) {
  return runAction(async () => {
    const manager = await requireManager();
    const values = subtaskUpdateSchema.parse(input);
    const existing = await prisma.subTask.findUnique({ where: { id: values.id } });
    if (!existing) throw new ActionError("Subtask not found.");
    const subtask = await prisma.subTask.update({
      where: { id: values.id },
      data: {
        ...(values.title !== undefined ? { title: values.title } : {}),
        ...(values.isCompleted !== undefined ? { isCompleted: values.isCompleted } : {}),
      },
    });
    await logActivity({
      actorId: manager.id,
      action: values.isCompleted !== undefined ? (values.isCompleted ? "SUBTASK_COMPLETED" : "SUBTASK_REOPENED") : "SUBTASK_UPDATED",
      entity: "SubTask",
      entityId: subtask.id,
      taskId: subtask.taskId,
      details: { title: subtask.title },
    });
    revalidatePath(`/tasks/${subtask.taskId}`);
    return { id: subtask.id, isCompleted: subtask.isCompleted };
  });
}

export async function deleteSubtask(id: string) {
  return runAction(async () => {
    const manager = await requireManager();
    const existing = await prisma.subTask.findUnique({ where: { id } });
    if (!existing) throw new ActionError("Subtask not found.");
    await prisma.subTask.delete({ where: { id } });
    await logActivity({
      actorId: manager.id,
      action: "SUBTASK_DELETED",
      entity: "SubTask",
      entityId: id,
      taskId: existing.taskId,
      details: { title: existing.title },
    });
    revalidatePath(`/tasks/${existing.taskId}`);
    return undefined;
  });
}
