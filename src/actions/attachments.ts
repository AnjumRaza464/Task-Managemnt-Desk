"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth-guard";
import { ActionError, runAction } from "@/lib/action-result";
import { logActivity } from "@/lib/activity";
import { MAX_ATTACHMENT_BYTES } from "@/lib/constants";

const BLOCKED_EXTENSIONS = /\.(exe|bat|cmd|sh|msi|dll|js|jar|ps1|vbs)$/i;

export async function uploadAttachment(formData: FormData) {
  return runAction(async () => {
    const manager = await requireManager();
    const taskId = String(formData.get("taskId") ?? "");
    const file = formData.get("file");

    if (!taskId) throw new ActionError("Task is required.");
    if (!(file instanceof File) || file.size === 0) throw new ActionError("Choose a file to upload.");
    if (file.size > MAX_ATTACHMENT_BYTES) throw new ActionError("File is larger than 5 MB.");
    if (BLOCKED_EXTENSIONS.test(file.name)) throw new ActionError("This file type is not allowed.");

    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true } });
    if (!task) throw new ActionError("Task not found.");

    const bytes = Buffer.from(await file.arrayBuffer());
    const attachment = await prisma.attachment.create({
      data: {
        taskId,
        uploadedById: manager.id,
        fileName: file.name.slice(0, 200),
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        data: bytes,
      },
      select: { id: true, fileName: true },
    });

    await logActivity({
      actorId: manager.id,
      action: "ATTACHMENT_ADDED",
      entity: "Attachment",
      entityId: attachment.id,
      taskId,
      details: { fileName: attachment.fileName },
    });
    revalidatePath(`/tasks/${taskId}`);
    return { id: attachment.id };
  });
}

export async function deleteAttachment(id: string) {
  return runAction(async () => {
    const manager = await requireManager();
    const attachment = await prisma.attachment.findUnique({
      where: { id },
      select: { id: true, taskId: true, fileName: true },
    });
    if (!attachment) throw new ActionError("Attachment not found.");
    await prisma.attachment.delete({ where: { id } });
    await logActivity({
      actorId: manager.id,
      action: "ATTACHMENT_DELETED",
      entity: "Attachment",
      entityId: id,
      taskId: attachment.taskId,
      details: { fileName: attachment.fileName },
    });
    revalidatePath(`/tasks/${attachment.taskId}`);
    return undefined;
  });
}
