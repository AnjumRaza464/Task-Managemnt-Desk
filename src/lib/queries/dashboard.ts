import "server-only";
import { subMonths } from "date-fns";
import { prisma } from "@/lib/prisma";
import { monthRange, thisWeekRange, todayRange } from "@/lib/dates";
import { MONTH_NAMES, PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { taskListInclude } from "@/lib/queries/tasks";
import type { TaskStatus } from "@/generated/prisma/enums";

const OPEN = { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] as TaskStatus[] };

export async function getDashboardData() {
  const [
    totalUsers,
    activeUsers,
    totalTasks,
    statusGroups,
    priorityGroups,
    completionAgg,
    dueToday,
    dueThisWeek,
    userPerformance,
    dueSoon,
    recentActivity,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.task.count(),
    prisma.task.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.task.groupBy({ by: ["priority"], _count: { _all: true } }),
    prisma.task.aggregate({ _avg: { completion: true }, where: { status: { not: "CANCELLED" } } }),
    prisma.task.count({ where: { dueDate: todayRange(), status: OPEN } }),
    prisma.task.count({ where: { dueDate: thisWeekRange(), status: OPEN } }),
    prisma.user.findMany({
      where: { isActive: true, assignedTasks: { some: {} } },
      select: {
        id: true,
        name: true,
        assignedTasks: { select: { status: true, completion: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.task.findMany({
      where: { status: OPEN },
      include: taskListInclude,
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 8,
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { actor: { select: { name: true } }, task: { select: { id: true, title: true } } },
    }),
  ]);

  const statusCounts = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as Record<(typeof TASK_STATUSES)[number], number>;
  for (const g of statusGroups) statusCounts[g.status] = g._count._all;

  const priorityCounts = Object.fromEntries(PRIORITIES.map((p) => [p, 0])) as Record<(typeof PRIORITIES)[number], number>;
  for (const g of priorityGroups) priorityCounts[g.priority] = g._count._all;

  const nonCancelled = totalTasks - statusCounts.CANCELLED;
  const completionRate = nonCancelled ? Math.round((statusCounts.COMPLETED / nonCancelled) * 100) : 0;

  // Monthly progress: last 6 months (by due date) — total vs completed.
  const now = new Date();
  const monthly = await Promise.all(
    Array.from({ length: 6 }, (_, i) => 5 - i).map(async (offset) => {
      const d = subMonths(now, offset);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const range = monthRange(year, month);
      const [total, completed, overdue] = await Promise.all([
        prisma.task.count({ where: { dueDate: range, status: { not: "CANCELLED" } } }),
        prisma.task.count({ where: { dueDate: range, status: "COMPLETED" } }),
        prisma.task.count({ where: { dueDate: range, status: "OVERDUE" } }),
      ]);
      return { label: `${MONTH_NAMES[month - 1].slice(0, 3)} ${String(year).slice(2)}`, total, completed, overdue };
    }),
  );

  const users = userPerformance.map((u) => {
    const tasks = u.assignedTasks;
    const completed = tasks.filter((t) => t.status === "COMPLETED").length;
    const overdue = tasks.filter((t) => t.status === "OVERDUE").length;
    const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const pending = tasks.filter((t) => t.status === "PENDING").length;
    return {
      id: u.id,
      name: u.name,
      total: tasks.length,
      completed,
      inProgress,
      pending,
      overdue,
      progress: tasks.length ? Math.round(tasks.reduce((s, t) => s + t.completion, 0) / tasks.length) : 0,
    };
  });

  return {
    stats: {
      totalUsers,
      activeUsers,
      totalTasks,
      completed: statusCounts.COMPLETED,
      pending: statusCounts.PENDING,
      inProgress: statusCounts.IN_PROGRESS,
      overdue: statusCounts.OVERDUE,
      cancelled: statusCounts.CANCELLED,
      completionRate,
      avgCompletion: Math.round(completionAgg._avg.completion ?? 0),
      dueToday,
      dueThisWeek,
    },
    statusCounts,
    priorityCounts,
    monthly,
    users,
    dueSoon,
    recentActivity,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
