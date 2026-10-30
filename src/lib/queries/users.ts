import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";

export type UserFilters = {
  q?: string;
  role?: Role | "ALL";
  status?: "active" | "inactive" | "all";
};

export async function getUsers(filters: UserFilters = {}) {
  const where: Prisma.UserWhereInput = {};
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { email: { contains: filters.q, mode: "insensitive" } },
      { department: { contains: filters.q, mode: "insensitive" } },
      { designation: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  if (filters.role && filters.role !== "ALL") where.role = filters.role;
  if (filters.status === "active") where.isActive = true;
  if (filters.status === "inactive") where.isActive = false;

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      designation: true,
      department: true,
      phone: true,
      isActive: true,
      createdAt: true,
      passwordHash: true,
      _count: { select: { taskAssignments: true } },
      taskAssignments: { where: { task: { status: "COMPLETED" } }, select: { taskId: true } },
    },
  });

  return users.map(({ passwordHash, ...u }) => ({
    ...u,
    hasPassword: Boolean(passwordHash),
    totalTasks: u._count.taskAssignments,
    completedTasks: u.taskAssignments.length,
    taskAssignments: undefined,
    _count: undefined,
  }));
}

export type UserRow = Awaited<ReturnType<typeof getUsers>>[number];

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      taskAssignments: {
        select: { task: { select: { status: true, completion: true } } },
      },
    },
  });
  if (!user) return null;

  const tasks = user.taskAssignments.map((a) => a.task);
  const byStatus = (s: string) => tasks.filter((t) => t.status === s).length;
  const stats = {
    total: tasks.length,
    completed: byStatus("COMPLETED"),
    pending: byStatus("PENDING"),
    inProgress: byStatus("IN_PROGRESS"),
    overdue: byStatus("OVERDUE"),
    cancelled: byStatus("CANCELLED"),
    avgCompletion: tasks.length
      ? Math.round(tasks.reduce((sum, t) => sum + t.completion, 0) / tasks.length)
      : 0,
  };

  return { ...user, stats };
}

/** Lightweight list for select inputs. */
export async function getAssignableUsers() {
  return prisma.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });
}
