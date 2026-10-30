import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/** Assignees of a task, oldest first (the primary assignee is the first one). */
export const assigneeSelect = {
  orderBy: { createdAt: "asc" },
  select: { userId: true, user: { select: { id: true, name: true, email: true } } },
} satisfies Prisma.Task$assigneesArgs;
