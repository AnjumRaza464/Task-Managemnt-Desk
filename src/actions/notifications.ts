"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";
import { runAction } from "@/lib/action-result";

function revalidate() {
  revalidatePath("/notifications");
  revalidatePath("/my-notifications");
  revalidatePath("/", "layout");
}

export async function markNotificationRead(id: string, isRead = true) {
  return runAction(async () => {
    const manager = await requireUser();
    await prisma.notification.updateMany({ where: { id, userId: manager.id }, data: { isRead } });
    revalidate();
    return undefined;
  });
}

export async function markAllNotificationsRead() {
  return runAction(async () => {
    const manager = await requireUser();
    const result = await prisma.notification.updateMany({
      where: { userId: manager.id, isRead: false },
      data: { isRead: true },
    });
    revalidate();
    return { count: result.count };
  });
}

export async function deleteNotification(id: string) {
  return runAction(async () => {
    const manager = await requireUser();
    await prisma.notification.deleteMany({ where: { id, userId: manager.id } });
    revalidate();
    return undefined;
  });
}

export async function clearReadNotifications() {
  return runAction(async () => {
    const manager = await requireUser();
    const result = await prisma.notification.deleteMany({ where: { userId: manager.id, isRead: true } });
    revalidate();
    return { count: result.count };
  });
}
