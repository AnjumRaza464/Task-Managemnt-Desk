"use server";

import { prisma } from "@/lib/prisma";
import { ActionError, runAction } from "@/lib/action-result";
import { getTaskAccess, requireUser } from "@/lib/permissions";

/**
 * Everything the task modal needs, as plain data: the task, who is on it,
 * subtasks, files, dependencies and what the current user may do.
 */
export async function getTaskPanel(taskId: string) {
  return runAction(async () => {
    const user = await requireUser();
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: { orderBy: { createdAt: "asc" }, select: { userId: true, user: { select: { id: true, name: true, email: true } } } },
        createdBy: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, color: true } },
        project: { select: { id: true, name: true, color: true } },
        list: { select: { id: true, name: true } },
        milestone: { select: { id: true, title: true } },
        subtasks: { orderBy: { position: "asc" }, select: { id: true, title: true, isCompleted: true } },
        attachments: {
          orderBy: { createdAt: "desc" },
          select: { id: true, fileName: true, mimeType: true, size: true, createdAt: true, uploadedBy: { select: { name: true } } },
        },
        blockedBy: { select: { blocker: { select: { id: true, title: true, status: true, dueDate: true } } } },
        blocks: { select: { blocked: { select: { id: true, title: true, status: true, dueDate: true } } } },
        _count: { select: { comments: true } },
      },
    });
    if (!task) throw new ActionError("Task not found.");
    const access = await getTaskAccess(user, task);
    if (!access.canView) throw new ActionError("You do not have access to this task.");
    const { attachments, ...rest } = task;
    return {
      ...rest,
      attachments: attachments.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
      startDate: task.startDate?.toISOString() ?? null,
      dueDate: task.dueDate.toISOString(),
      completedAt: task.completedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      recurrenceEndsAt: task.recurrenceEndsAt?.toISOString() ?? null,
      recurrenceSpawnedAt: task.recurrenceSpawnedAt?.toISOString() ?? null,
      blockedBy: task.blockedBy.map((d) => ({ ...d.blocker, dueDate: d.blocker.dueDate.toISOString() })),
      blocks: task.blocks.map((d) => ({ ...d.blocked, dueDate: d.blocked.dueDate.toISOString() })),
      access,
      currentUserId: user.id,
    };
  });
}

export type TaskPanel = Extract<Awaited<ReturnType<typeof getTaskPanel>>, { ok: true }>["data"];
