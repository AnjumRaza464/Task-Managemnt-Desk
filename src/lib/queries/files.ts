import "server-only";
import { prisma } from "@/lib/prisma";

const sharedFileSelect = {
  id: true,
  fileName: true,
  mimeType: true,
  size: true,
  note: true,
  isPublic: true,
  createdAt: true,
  sharedBy: { select: { id: true, name: true } },
} as const;

/** Every shared file, with who it went to and who has opened it (manager view). */
export async function getSharedFiles() {
  return prisma.sharedFile.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      ...sharedFileSelect,
      recipients: {
        select: { userId: true, viewedAt: true, user: { select: { name: true } } },
        orderBy: { user: { name: "asc" } },
      },
    },
  });
}

export type SharedFileRow = Awaited<ReturnType<typeof getSharedFiles>>[number];

/** Files the given user may open: public ones plus those shared with them directly. */
export async function getFilesForUser(userId: string) {
  const files = await prisma.sharedFile.findMany({
    where: { OR: [{ isPublic: true }, { recipients: { some: { userId } } }] },
    orderBy: { createdAt: "desc" },
    select: { ...sharedFileSelect, recipients: { where: { userId }, select: { viewedAt: true } } },
  });
  return files.map(({ recipients, ...file }) => ({ ...file, viewedAt: recipients[0]?.viewedAt ?? null }));
}

export type UserFileRow = Awaited<ReturnType<typeof getFilesForUser>>[number];

/** Files visible to the user that they have not opened yet (excluding their own). */
export async function getUnseenFileCount(userId: string): Promise<number> {
  return prisma.sharedFile.count({
    where: {
      sharedById: { not: userId },
      OR: [
        { isPublic: true, recipients: { none: { userId, viewedAt: { not: null } } } },
        { isPublic: false, recipients: { some: { userId, viewedAt: null } } },
      ],
    },
  });
}
