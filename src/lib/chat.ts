import "server-only";
import { prisma } from "@/lib/prisma";
import {
  CONVERSATION_PAGE_SIZE,
  ONLINE_WINDOW_MS,
  PRESENCE_WRITE_INTERVAL_MS,
  type ChatContact,
  type ChatMessageDto,
} from "@/lib/chat-types";
import type { Prisma } from "@/generated/prisma/client";

export const messageInclude = { sender: { select: { name: true } } } satisfies Prisma.ChatMessageInclude;
type MessageRow = Prisma.ChatMessageGetPayload<{ include: typeof messageInclude }>;

export function toMessageDto(m: MessageRow): ChatMessageDto {
  return {
    id: m.id,
    senderId: m.senderId,
    senderName: m.sender.name,
    recipientId: m.recipientId,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  };
}

/** Records that the user is active. Skips the write if it was refreshed recently. */
export async function touchPresence(userId: string) {
  const now = new Date();
  const stale = new Date(now.getTime() - PRESENCE_WRITE_INTERVAL_MS);
  await prisma.user.updateMany({
    where: { id: userId, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: stale } }] },
    data: { lastSeenAt: now },
  });
}

export function isOnline(lastSeenAt: Date | null, now = Date.now()) {
  return !!lastSeenAt && now - lastSeenAt.getTime() < ONLINE_WINDOW_MS;
}

/** Every other active user, with presence, unread count and last message time. */
export async function getChatContacts(userId: string): Promise<ChatContact[]> {
  const [users, unread, sent, received] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, id: { not: userId } },
      select: { id: true, name: true, role: true, designation: true, lastSeenAt: true },
      orderBy: { name: "asc" },
    }),
    prisma.chatMessage.groupBy({
      by: ["senderId"],
      where: { recipientId: userId, readAt: null },
      _count: { _all: true },
    }),
    prisma.chatMessage.groupBy({
      by: ["recipientId"],
      where: { senderId: userId, recipientId: { not: null } },
      _max: { createdAt: true },
    }),
    prisma.chatMessage.groupBy({
      by: ["senderId"],
      where: { recipientId: userId },
      _max: { createdAt: true },
    }),
  ]);

  const unreadBy = new Map(unread.map((u) => [u.senderId, u._count._all]));
  const lastAt = new Map<string, Date>();
  for (const row of sent) if (row.recipientId && row._max.createdAt) lastAt.set(row.recipientId, row._max.createdAt);
  for (const row of received) {
    const at = row._max.createdAt;
    if (!at) continue;
    const prev = lastAt.get(row.senderId);
    if (!prev || at > prev) lastAt.set(row.senderId, at);
  }

  const now = Date.now();
  const contacts: ChatContact[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    designation: u.designation,
    online: isOnline(u.lastSeenAt, now),
    lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
    unread: unreadBy.get(u.id) ?? 0,
    lastMessageAt: lastAt.get(u.id)?.toISOString() ?? null,
  }));

  // Most recent conversations first, then online users, then by name.
  contacts.sort((a, b) => {
    if (a.lastMessageAt !== b.lastMessageAt) {
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return a.lastMessageAt < b.lastMessageAt ? 1 : -1;
    }
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return contacts;
}

async function pageMessages(where: Prisma.ChatMessageWhereInput, since?: Date): Promise<ChatMessageDto[]> {
  if (since) {
    const rows = await prisma.chatMessage.findMany({
      where: { ...where, createdAt: { gte: since } },
      include: messageInclude,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toMessageDto);
  }
  const rows = await prisma.chatMessage.findMany({
    where,
    include: messageInclude,
    orderBy: { createdAt: "desc" },
    take: CONVERSATION_PAGE_SIZE,
  });
  return rows.reverse().map(toMessageDto);
}

/**
 * Direct messages between two users. Without `since`, the latest page in
 * chronological order; with `since`, everything created at or after that moment.
 */
export function getConversation(userId: string, otherId: string, since?: Date) {
  return pageMessages(
    {
      OR: [
        { senderId: userId, recipientId: otherId },
        { senderId: otherId, recipientId: userId },
      ],
    },
    since,
  );
}

/** Messages in the shared team channel (same paging rules as getConversation). */
export function getTeamMessages(since?: Date) {
  return pageMessages({ recipientId: null }, since);
}

/** Marks everything `otherId` sent to `userId` as read. */
export async function markConversationRead(userId: string, otherId: string) {
  await prisma.chatMessage.updateMany({
    where: { recipientId: userId, senderId: otherId, readAt: null },
    data: { readAt: new Date() },
  });
}

/** Remembers that the user has seen the team channel up to now. */
export async function markTeamRead(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { teamChatReadAt: new Date() } });
}

/** Team-channel messages from other people since the user last opened the channel. */
export async function getTeamUnread(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { teamChatReadAt: true } });
  return prisma.chatMessage.count({
    where: {
      recipientId: null,
      senderId: { not: userId },
      ...(user?.teamChatReadAt ? { createdAt: { gt: user.teamChatReadAt } } : {}),
    },
  });
}
