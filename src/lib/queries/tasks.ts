import "server-only";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE, PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { monthRange, parseDateInput } from "@/lib/dates";
import { parseMonthKey } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";
import type { Priority, TaskStatus } from "@/generated/prisma/enums";

export type TaskFilters = {
  q: string;
  user: string;
  month: string; // yyyy-MM or ""
  status: TaskStatus | "";
  priority: Priority | "";
  category: string;
  dueFrom: string;
  dueTo: string;
  sort: "dueDate" | "priority" | "status" | "title" | "createdAt" | "completion" | "assignee";
  dir: "asc" | "desc";
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export function parseTaskFilters(params: SearchParams): TaskFilters {
  const status = str(params.status);
  const priority = str(params.priority);
  const sort = str(params.sort);
  const dir = str(params.dir);
  const page = Number(str(params.page)) || 1;
  const month = str(params.month);
  return {
    q: str(params.q).trim(),
    user: str(params.user),
    month: /^\d{4}-\d{2}$/.test(month) ? month : "",
    status: (TASK_STATUSES as string[]).includes(status) ? (status as TaskStatus) : "",
    priority: (PRIORITIES as string[]).includes(priority) ? (priority as Priority) : "",
    category: str(params.category),
    dueFrom: /^\d{4}-\d{2}-\d{2}$/.test(str(params.dueFrom)) ? str(params.dueFrom) : "",
    dueTo: /^\d{4}-\d{2}-\d{2}$/.test(str(params.dueTo)) ? str(params.dueTo) : "",
    sort: (["dueDate", "priority", "status", "title", "createdAt", "completion", "assignee"] as const).includes(
      sort as TaskFilters["sort"],
    )
      ? (sort as TaskFilters["sort"])
      : "dueDate",
    dir: dir === "desc" ? "desc" : "asc",
    page: page > 0 ? page : 1,
  };
}

export function buildTaskWhere(f: Partial<TaskFilters>): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = {};
  if (f.q) {
    where.OR = [
      { title: { contains: f.q, mode: "insensitive" } },
      { description: { contains: f.q, mode: "insensitive" } },
      { assignee: { name: { contains: f.q, mode: "insensitive" } } },
    ];
  }
  if (f.user) where.assigneeId = f.user;
  if (f.status) where.status = f.status;
  if (f.priority) where.priority = f.priority;
  if (f.category) where.categoryId = f.category === "none" ? null : f.category;
  if (f.month) {
    const { year, month } = parseMonthKey(f.month);
    where.plan = { year, month };
  }
  if (f.dueFrom || f.dueTo) {
    where.dueDate = {
      ...(f.dueFrom ? { gte: parseDateInput(f.dueFrom) } : {}),
      ...(f.dueTo ? { lte: parseDateInput(f.dueTo) } : {}),
    };
  }
  return where;
}

const PRIORITY_RANK: Record<Priority, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
const STATUS_RANK: Record<TaskStatus, number> = { PENDING: 0, IN_PROGRESS: 1, OVERDUE: 2, COMPLETED: 3, CANCELLED: 4 };

export const taskListInclude = {
  assignee: { select: { id: true, name: true, email: true } },
  category: { select: { id: true, name: true, color: true } },
  plan: { select: { id: true, year: true, month: true } },
  _count: { select: { subtasks: true, comments: true, attachments: true } },
  subtasks: { select: { isCompleted: true } },
} satisfies Prisma.TaskInclude;

export type TaskListItem = Prisma.TaskGetPayload<{ include: typeof taskListInclude }>;

export async function getTasks(filters: TaskFilters, pageSize = PAGE_SIZE) {
  const where = buildTaskWhere(filters);

  // Priority/status ordering by rank needs in-memory sorting; other sorts go to the DB.
  const dbSortable = filters.sort !== "priority" && filters.sort !== "status";
  const orderBy: Prisma.TaskOrderByWithRelationInput[] = dbSortable
    ? filters.sort === "assignee"
      ? [{ assignee: { name: filters.dir } }, { dueDate: "asc" }]
      : [{ [filters.sort]: filters.dir }, { createdAt: "desc" }]
    : [{ dueDate: "asc" }];

  const total = await prisma.task.count({ where });

  let items: TaskListItem[];
  if (dbSortable) {
    items = await prisma.task.findMany({
      where,
      include: taskListInclude,
      orderBy,
      skip: (filters.page - 1) * pageSize,
      take: pageSize,
    });
  } else {
    const all = await prisma.task.findMany({ where, include: taskListInclude, orderBy });
    const rank = filters.sort === "priority" ? (t: TaskListItem) => PRIORITY_RANK[t.priority] : (t: TaskListItem) => STATUS_RANK[t.status];
    all.sort((a, b) => (filters.dir === "asc" ? rank(a) - rank(b) : rank(b) - rank(a)));
    items = all.slice((filters.page - 1) * pageSize, filters.page * pageSize);
  }

  return { items, total, page: filters.page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

/** All tasks matching filters (no pagination) — used by kanban & calendar & exports. */
export async function getAllTasks(filters: Partial<TaskFilters>) {
  return prisma.task.findMany({
    where: buildTaskWhere(filters),
    include: taskListInclude,
    orderBy: [{ position: "asc" }, { dueDate: "asc" }],
  });
}

export async function getTasksForMonth(year: number, month: number, filters: Partial<TaskFilters> = {}) {
  return prisma.task.findMany({
    where: { ...buildTaskWhere(filters), dueDate: monthRange(year, month) },
    include: taskListInclude,
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
  });
}

export async function getTaskById(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, name: true, email: true, designation: true } },
      createdBy: { select: { id: true, name: true } },
      category: true,
      plan: { select: { id: true, year: true, month: true, title: true } },
      subtasks: { orderBy: { position: "asc" } },
      comments: { orderBy: { createdAt: "desc" }, include: { author: { select: { id: true, name: true } } } },
      attachments: {
        orderBy: { createdAt: "desc" },
        select: { id: true, fileName: true, mimeType: true, size: true, createdAt: true, uploadedBy: { select: { name: true } } },
      },
      activity: { orderBy: { createdAt: "desc" }, take: 50, include: { actor: { select: { name: true } } } },
    },
  });
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskById>>>;

export async function getTaskFormOptions() {
  const [users, categories] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
  ]);
  return { users, categories };
}

export type TaskFormOptions = Awaited<ReturnType<typeof getTaskFormOptions>>;
