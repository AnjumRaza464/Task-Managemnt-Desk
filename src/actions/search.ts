"use server";

import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-guard";
import { MONTH_NAMES, ROLE_LABELS, STATUS_LABELS } from "@/lib/constants";

export type SearchHit = { id: string; label: string; detail?: string; href: string };

export type SearchResults = {
  q: string;
  tasks: SearchHit[];
  users: SearchHit[];
  plans: SearchHit[];
  files: SearchHit[];
};

const TAKE = { tasks: 8, users: 5, plans: 5, files: 5 };

/**
 * Header search across tasks, users, monthly plans and shared files.
 * Managers search everything; members search only their own tasks and the
 * files they can open.
 */
export async function globalSearch(raw: string): Promise<SearchResults> {
  const q = String(raw ?? "").trim().slice(0, 80);
  const empty: SearchResults = { q, tasks: [], users: [], plans: [], files: [] };
  const user = await getCurrentUser();
  if (!user || q.length < 2) return empty;

  const contains = { contains: q, mode: "insensitive" as const };

  if (user.role === "MEMBER") {
    const [tasks, files] = await Promise.all([
      prisma.task.findMany({
        where: { assignees: { some: { userId: user.id } }, OR: [{ title: contains }, { description: contains }] },
        select: { id: true, title: true, status: true, dueDate: true },
        orderBy: { dueDate: "desc" },
        take: TAKE.tasks,
      }),
      prisma.sharedFile.findMany({
        where: {
          AND: [
            { OR: [{ isPublic: true }, { recipients: { some: { userId: user.id } } }] },
            { OR: [{ fileName: contains }, { note: contains }] },
          ],
        },
        select: { id: true, fileName: true, sharedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: TAKE.files,
      }),
    ]);
    return {
      ...empty,
      tasks: tasks.map((t) => ({
        id: t.id,
        label: t.title,
        detail: `${STATUS_LABELS[t.status]} · due ${format(t.dueDate, "MMM d")}`,
        href: `/my-tasks/${t.id}`,
      })),
      files: files.map((f) => ({ id: f.id, label: f.fileName, detail: `Shared by ${f.sharedBy.name}`, href: "/my-files" })),
    };
  }

  const [tasks, users, plans, files] = await Promise.all([
    prisma.task.findMany({
      where: { OR: [{ title: contains }, { description: contains }, { assignees: { some: { user: { name: contains } } } }] },
      select: { id: true, title: true, status: true, dueDate: true, assignees: { select: { user: { select: { name: true } } } } },
      orderBy: { dueDate: "desc" },
      take: TAKE.tasks,
    }),
    prisma.user.findMany({
      where: { OR: [{ name: contains }, { email: contains }, { department: contains }, { designation: contains }] },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
      take: TAKE.users,
    }),
    prisma.monthlyPlan.findMany({
      where: { OR: [{ title: contains }, { user: { name: contains } }] },
      select: { id: true, year: true, month: true, title: true, user: { select: { name: true } }, _count: { select: { tasks: true } } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: TAKE.plans,
    }),
    prisma.sharedFile.findMany({
      where: { OR: [{ fileName: contains }, { note: contains }] },
      select: { id: true, fileName: true, sharedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: TAKE.files,
    }),
  ]);

  return {
    q,
    tasks: tasks.map((t) => ({
      id: t.id,
      label: t.title,
      detail: `${t.assignees.map((a) => a.user.name).join(", ") || "Unassigned"} · ${STATUS_LABELS[t.status]} · due ${format(t.dueDate, "MMM d")}`,
      href: `/tasks/${t.id}`,
    })),
    users: users.map((u) => ({ id: u.id, label: u.name, detail: `${ROLE_LABELS[u.role]} · ${u.email}`, href: `/users/${u.id}` })),
    plans: plans.map((p) => ({
      id: p.id,
      label: `${MONTH_NAMES[p.month - 1]} ${p.year} · ${p.user.name}`,
      detail: [p.title, `${p._count.tasks} task${p._count.tasks === 1 ? "" : "s"}`].filter(Boolean).join(" · "),
      href: `/monthly-plans/${p.id}`,
    })),
    files: files.map((f) => ({ id: f.id, label: f.fileName, detail: `Shared by ${f.sharedBy.name}`, href: "/files" })),
  };
}
