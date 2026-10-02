import "server-only";
import { prisma } from "@/lib/prisma";
import { taskListInclude } from "@/lib/queries/tasks";

/** Every active user with their plan (if any) and task stats for a given month. */
export async function getMonthOverview(year: number, month: number) {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      designation: true,
      department: true,
      plans: {
        where: { year, month },
        select: {
          id: true,
          title: true,
          notes: true,
          tasks: { select: { status: true, completion: true } },
        },
      },
    },
  });

  return users.map((u) => {
    const plan = u.plans[0] ?? null;
    const tasks = plan?.tasks ?? [];
    const count = (s: string) => tasks.filter((t) => t.status === s).length;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      designation: u.designation,
      department: u.department,
      plan: plan ? { id: plan.id, title: plan.title, notes: plan.notes } : null,
      stats: {
        total: tasks.length,
        completed: count("COMPLETED"),
        inProgress: count("IN_PROGRESS"),
        pending: count("PENDING"),
        overdue: count("OVERDUE"),
        cancelled: count("CANCELLED"),
        progress: tasks.length ? Math.round(tasks.reduce((s, t) => s + t.completion, 0) / tasks.length) : 0,
      },
    };
  });
}

export type MonthOverviewRow = Awaited<ReturnType<typeof getMonthOverview>>[number];

export async function getPlanById(id: string) {
  return prisma.monthlyPlan.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, designation: true, department: true, isActive: true } },
      tasks: { include: taskListInclude, orderBy: [{ dueDate: "asc" }, { priority: "desc" }] },
    },
  });
}

export type PlanDetail = NonNullable<Awaited<ReturnType<typeof getPlanById>>>;

/** Distinct months that have plans, newest first (for month pickers). */
export async function getPlanMonths() {
  const rows = await prisma.monthlyPlan.findMany({
    distinct: ["year", "month"],
    select: { year: true, month: true },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
  return rows;
}
