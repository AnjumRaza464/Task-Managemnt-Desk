"use server";

import { prisma } from "@/lib/prisma";
import { ActionError, runAction } from "@/lib/action-result";
import { logActivity, notifyUsers } from "@/lib/activity";
import { parseDateInput } from "@/lib/dates";
import { requireProjectAccess } from "@/lib/permissions";
import { revalidateProjectViews } from "@/lib/project-members";
import { revalidateTaskViews } from "@/lib/task-views";
import { milestoneSchema, milestoneUpdateSchema } from "@/lib/validations/project";

export async function createMilestone(input: unknown) {
  return runAction(async () => {
    const values = milestoneSchema.parse(input);
    const { user } = await requireProjectAccess(values.projectId, "manage");
    const last = await prisma.milestone.aggregate({ _max: { position: true }, where: { projectId: values.projectId } });
    const milestone = await prisma.milestone.create({
      data: {
        projectId: values.projectId,
        title: values.title,
        description: values.description,
        dueDate: values.dueDate ? parseDateInput(values.dueDate) : null,
        position: (last._max.position ?? 0) + 1,
      },
    });
    await logActivity({
      actorId: user.id,
      action: "MILESTONE_CREATED",
      entity: "Milestone",
      entityId: milestone.id,
      projectId: values.projectId,
      details: { title: milestone.title },
    });
    revalidateProjectViews(values.projectId);
    return { id: milestone.id };
  });
}

export async function updateMilestone(input: unknown) {
  return runAction(async () => {
    const values = milestoneUpdateSchema.parse(input);
    const existing = await prisma.milestone.findUnique({
      where: { id: values.id },
      include: { project: { select: { name: true, members: { select: { userId: true } } } } },
    });
    if (!existing) throw new ActionError("Milestone not found.");
    const { user } = await requireProjectAccess(existing.projectId, "manage");

    const completing = values.completed === true && !existing.completedAt;
    const reopening = values.completed === false && Boolean(existing.completedAt);
    const milestone = await prisma.$transaction(async (tx) => {
      const updated = await tx.milestone.update({
        where: { id: values.id },
        data: {
          ...(values.title !== undefined ? { title: values.title } : {}),
          ...(values.description !== undefined ? { description: values.description } : {}),
          ...(values.dueDate !== undefined ? { dueDate: values.dueDate ? parseDateInput(values.dueDate) : null } : {}),
          ...(completing ? { completedAt: new Date() } : reopening ? { completedAt: null } : {}),
        },
      });
      await logActivity(
        {
          actorId: user.id,
          action: completing ? "MILESTONE_COMPLETED" : reopening ? "MILESTONE_REOPENED" : "MILESTONE_UPDATED",
          entity: "Milestone",
          entityId: updated.id,
          projectId: updated.projectId,
          details: { title: updated.title },
        },
        tx,
      );
      if (completing) {
        await notifyUsers(
          {
            userIds: existing.project.members.map((m) => m.userId),
            type: "MILESTONE_REACHED",
            title: "Milestone reached",
            message: `${user.name} marked "${updated.title}" (${existing.project.name}) as reached.`,
            projectId: updated.projectId,
            excludeUserId: user.id,
            dedupeKey: `MILESTONE:${updated.id}`,
          },
          tx,
        );
      }
      return updated;
    });
    revalidateProjectViews(milestone.projectId);
    return { id: milestone.id, completed: Boolean(milestone.completedAt) };
  });
}

export async function deleteMilestone(id: string) {
  return runAction(async () => {
    const existing = await prisma.milestone.findUnique({ where: { id }, include: { _count: { select: { tasks: true } } } });
    if (!existing) throw new ActionError("Milestone not found.");
    const { user } = await requireProjectAccess(existing.projectId, "manage");
    await prisma.milestone.delete({ where: { id } }); // tasks keep existing, milestoneId becomes null
    await logActivity({
      actorId: user.id,
      action: "MILESTONE_DELETED",
      entity: "Milestone",
      entityId: id,
      projectId: existing.projectId,
      details: { title: existing.title, detachedTasks: existing._count.tasks },
    });
    revalidateProjectViews(existing.projectId);
    revalidateTaskViews();
    return undefined;
  });
}
