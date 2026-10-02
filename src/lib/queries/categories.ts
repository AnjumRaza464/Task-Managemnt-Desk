import "server-only";
import { prisma } from "@/lib/prisma";

export async function getCategories() {
  const rows = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { tasks: true } } },
  });
  return rows.map((c) => ({ id: c.id, name: c.name, color: c.color, taskCount: c._count.tasks }));
}

export type CategoryRow = Awaited<ReturnType<typeof getCategories>>[number];
