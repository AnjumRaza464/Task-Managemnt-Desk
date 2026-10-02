import "server-only";
import { prisma } from "@/lib/prisma";

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function getNotifications(userId: string, filter: "all" | "unread" = "all") {
  return prisma.notification.findMany({
    where: { userId, ...(filter === "unread" ? { isRead: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      task: { select: { id: true, title: true } },
    },
  });
}
