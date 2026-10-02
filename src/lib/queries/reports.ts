import "server-only";
import { prisma } from "@/lib/prisma";
import { monthRange } from "@/lib/dates";
import { PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { taskListInclude } from "@/lib/queries/tasks";
import type { Priority, TaskStatus } from "@/generated/prisma/enums";

export type ReportScope = { year: number; month: number; all?: boolean };

function scopeWhere(scope: ReportScope) {
  return scope.all ? {} : { dueDate: monthRange(scope.year, scope.month) };
}

/** Monthly task report: every task in the month with full details. */
export async function getMonthlyReport(scope: ReportScope) {
  const tasks = await prisma.task.findMany({
    where: scopeWhere(scope),
    include: taskListInclude,
    orderBy: [{ assignee: { name: "asc" } }, { dueDate: "asc" }],
  });
  const summary = summarize(tasks.map((t) => ({ status: t.status, completion: t.completion })));
  return { tasks, summary };
}

/** User-wise performance: per user counts + completion rate. */
export async function getUserPerformanceReport(scope: ReportScope) {
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      isActive: true,
      assignedTasks: { where: scopeWhere(scope), select: { status: true, completion: true, priority: true } },
    },
  });
  return users
    .filter((u) => u.assignedTasks.length > 0 || u.isActive)
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      department: u.department,
      isActive: u.isActive,
      ...summarize(u.assignedTasks),
      critical: u.assignedTasks.filter((t) => t.priority === "CRITICAL").length,
      high: u.assignedTasks.filter((t) => t.priority === "HIGH").length,
    }));
}

/** Status report: counts by status + task lists for completed / pending / overdue. */
export async function getStatusReport(scope: ReportScope) {
  const tasks = await prisma.task.findMany({
    where: scopeWhere(scope),
    include: taskListInclude,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });
  const byStatus = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
  for (const t of tasks) byStatus[t.status] += 1;
  return { tasks, byStatus, total: tasks.length };
}

/** Priority report: counts by priority × status. */
export async function getPriorityReport(scope: ReportScope) {
  const tasks = await prisma.task.findMany({
    where: scopeWhere(scope),
    include: taskListInclude,
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
  });
  const matrix = PRIORITIES.map((priority) => {
    const rows = tasks.filter((t) => t.priority === priority);
    const counts = Object.fromEntries(TASK_STATUSES.map((s) => [s, rows.filter((t) => t.status === s).length])) as Record<
      TaskStatus,
      number
    >;
    return { priority: priority as Priority, total: rows.length, ...counts };
  });
  return { tasks, matrix, total: tasks.length };
}

function summarize(tasks: { status: TaskStatus; completion: number }[]) {
  const count = (s: TaskStatus) => tasks.filter((t) => t.status === s).length;
  const total = tasks.length;
  const completed = count("COMPLETED");
  const cancelled = count("CANCELLED");
  const denominator = total - cancelled;
  return {
    total,
    completed,
    pending: count("PENDING"),
    inProgress: count("IN_PROGRESS"),
    overdue: count("OVERDUE"),
    cancelled,
    completionRate: denominator ? Math.round((completed / denominator) * 100) : 0,
    avgProgress: total ? Math.round(tasks.reduce((s, t) => s + t.completion, 0) / total) : 0,
  };
}
