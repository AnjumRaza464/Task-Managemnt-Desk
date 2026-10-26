"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth-guard";
import { ActionError, runAction } from "@/lib/action-result";
import { logActivity } from "@/lib/activity";
import { MAX_SHARED_FILE_BYTES } from "@/lib/constants";

const BLOCKED_EXTENSIONS = /\.(exe|bat|cmd|sh|msi|dll|js|jar|ps1|vbs)$/i;

/**
 * Shares an uploaded file with everyone (`audience=all`) or with the users
 * listed in `userIds` (`audience=users`), and notifies each recipient.
 */
export async function shareFile(formData: FormData) {
  return runAction(async () => {
    const manager = await requireManager();
    const file = formData.get("file");
    const note = String(formData.get("note") ?? "").trim().slice(0, 500);
    const audience = formData.get("audience") === "users" ? "users" : "all";
    const userIds = [...new Set(formData.getAll("userIds").map(String).filter(Boolean))];

    if (!(file instanceof File) || file.size === 0) throw new ActionError("Choose a file to share.");
    if (file.size > MAX_SHARED_FILE_BYTES) throw new ActionError("File is larger than 4 MB.");
    if (BLOCKED_EXTENSIONS.test(file.name)) throw new ActionError("This file type is not allowed.");

    let recipientIds: string[] = [];
    if (audience === "users") {
      if (userIds.length === 0) throw new ActionError("Choose at least one user.");
      const users = await prisma.user.findMany({
        where: { id: { in: userIds }, isActive: true },
        select: { id: true },
      });
      recipientIds = users.map((u) => u.id);
      if (recipientIds.length === 0) throw new ActionError("Choose at least one active user.");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.slice(0, 200);

    const shared = await prisma.$transaction(async (tx) => {
      const created = await tx.sharedFile.create({
        data: {
          sharedById: manager.id,
          fileName,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          data: bytes,
          note: note || null,
          isPublic: audience === "all",
          recipients: { create: recipientIds.map((userId) => ({ userId })) },
        },
        select: { id: true, fileName: true },
      });

      const notifyIds =
        audience === "all"
          ? (
              await tx.user.findMany({
                where: { isActive: true, id: { not: manager.id } },
                select: { id: true },
              })
            ).map((u) => u.id)
          : recipientIds.filter((id) => id !== manager.id);

      if (notifyIds.length > 0) {
        await tx.notification.createMany({
          data: notifyIds.map((userId) => ({
            userId,
            type: "FILE_SHARED" as const,
            title: "New file shared with you",
            message: `${manager.name} shared "${created.fileName}"${note ? ` · ${note}` : ""}`,
          })),
        });
      }

      await logActivity(
        {
          actorId: manager.id,
          action: "FILE_SHARED",
          entity: "SharedFile",
          entityId: created.id,
          details: { fileName: created.fileName, audience, recipients: recipientIds.length },
        },
        tx,
      );
      return created;
    });

    revalidatePath("/files");
    revalidatePath("/my-files");
    return { id: shared.id };
  });
}

export async function deleteSharedFile(id: string) {
  return runAction(async () => {
    const manager = await requireManager();
    const file = await prisma.sharedFile.findUnique({ where: { id }, select: { id: true, fileName: true } });
    if (!file) throw new ActionError("File not found.");
    await prisma.sharedFile.delete({ where: { id } });
    await logActivity({
      actorId: manager.id,
      action: "FILE_UNSHARED",
      entity: "SharedFile",
      entityId: id,
      details: { fileName: file.fileName },
    });
    revalidatePath("/files");
    revalidatePath("/my-files");
    return undefined;
  });
}
