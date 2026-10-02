"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth-guard";
import { ActionError, runAction } from "@/lib/action-result";
import { logActivity } from "@/lib/activity";
import { planSchema } from "@/lib/validations/task";
import { z } from "zod";

const ensurePlanSchema = z.object({
  userId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

/** Creates the plan row for (user, month) if missing and returns its id. */
export async function ensurePlan(input: unknown) {
  return runAction(async () => {
    const manager = await requireManager();
    const { userId, year, month } = ensurePlanSchema.parse(input);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true } });
    if (!user) throw new ActionError("User not found.");
    if (!user.isActive) throw new ActionError("This user is inactive.");

    const plan = await prisma.monthlyPlan.upsert({
      where: { userId_year_month: { userId, year, month } },
      update: {},
      create: { userId, year, month },
    });
    await logActivity({
      actorId: manager.id,
      action: "PLAN_OPENED",
      entity: "MonthlyPlan",
      entityId: plan.id,
      details: { year, month },
    });
    revalidatePath("/monthly-plans");
    return { id: plan.id };
  });
}

export async function updatePlan(input: unknown) {
  return runAction(async () => {
    const manager = await requireManager();
    const values = planSchema.parse(input);
    const plan = await prisma.monthlyPlan.update({
      where: { id: values.id },
      data: { title: values.title, notes: values.notes },
    });
    await logActivity({
      actorId: manager.id,
      action: "PLAN_UPDATED",
      entity: "MonthlyPlan",
      entityId: plan.id,
      details: { title: plan.title },
    });
    revalidatePath("/monthly-plans");
    revalidatePath(`/monthly-plans/${plan.id}`);
    return { id: plan.id };
  });
}

export async function deletePlan(id: string) {
  return runAction(async () => {
    const manager = await requireManager();
    const plan = await prisma.monthlyPlan.findUnique({
      where: { id },
      include: { _count: { select: { tasks: true } } },
    });
    if (!plan) throw new ActionError("Plan not found.");
    await prisma.monthlyPlan.delete({ where: { id } }); // cascades tasks
    await logActivity({
      actorId: manager.id,
      action: "PLAN_DELETED",
      entity: "MonthlyPlan",
      entityId: id,
      details: { year: plan.year, month: plan.month, deletedTasks: plan._count.tasks },
    });
    for (const p of ["/monthly-plans", "/tasks", "/dashboard", "/calendar", "/reports"]) revalidatePath(p);
    return { deletedTasks: plan._count.tasks };
  });
}
