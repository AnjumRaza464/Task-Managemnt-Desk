"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth-guard";
import { ActionError, runAction } from "@/lib/action-result";
import { logActivity, notifyManagers } from "@/lib/activity";
import { commentSchema } from "@/lib/validations/task";

export async function addComment(input: unknown) {
  return runAction(async () => {
    const manager = await requireManager();
    const values = commentSchema.parse(input);
    const task = await prisma.task.findUnique({ where: { id: values.taskId }, select: { id: true, title: true } });
    if (!task) throw new ActionError("Task not found.");

    const comment = await prisma.comment.create({
      data: { taskId: values.taskId, authorId: manager.id, content: values.content },
    });
    await logActivity({
      actorId: manager.id,
      action: "COMMENT_ADDED",
      entity: "Comment",
      entityId: comment.id,
      taskId: task.id,
      details: { excerpt: values.content.slice(0, 80) },
    });
    await notifyManagers({
      type: "COMMENT_ADDED",
      title: "New comment",
      message: `${manager.name} commented on "${task.title}".`,
      taskId: task.id,
      excludeUserId: manager.id,
    });
    revalidatePath(`/tasks/${task.id}`);
    revalidatePath("/notifications");
    return { id: comment.id };
  });
}

export async function deleteComment(id: string) {
  return runAction(async () => {
    const manager = await requireManager();
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new ActionError("Comment not found.");
    await prisma.comment.delete({ where: { id } });
    await logActivity({
      actorId: manager.id,
      action: "COMMENT_DELETED",
      entity: "Comment",
      entityId: id,
      taskId: comment.taskId,
    });
    revalidatePath(`/tasks/${comment.taskId}`);
    return undefined;
  });
}
