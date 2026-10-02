"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth-guard";
import { ActionError, runAction } from "@/lib/action-result";
import { logActivity } from "@/lib/activity";
import { categorySchema } from "@/lib/validations/task";

function revalidate() {
  revalidatePath("/settings");
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function createCategory(input: unknown) {
  return runAction(async () => {
    const manager = await requireManager();
    const values = categorySchema.parse(input);
    const category = await prisma.category.create({ data: values });
    await logActivity({
      actorId: manager.id,
      action: "CATEGORY_CREATED",
      entity: "Category",
      entityId: category.id,
      details: { name: category.name },
    });
    revalidate();
    return { id: category.id };
  });
}

export async function updateCategory(id: string, input: unknown) {
  return runAction(async () => {
    const manager = await requireManager();
    const values = categorySchema.parse(input);
    const category = await prisma.category.update({ where: { id }, data: values });
    await logActivity({
      actorId: manager.id,
      action: "CATEGORY_UPDATED",
      entity: "Category",
      entityId: category.id,
      details: { name: category.name },
    });
    revalidate();
    return { id: category.id };
  });
}

export async function deleteCategory(id: string) {
  return runAction(async () => {
    const manager = await requireManager();
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) throw new ActionError("Category not found.");
    await prisma.category.delete({ where: { id } }); // tasks keep working (categoryId -> null)
    await logActivity({
      actorId: manager.id,
      action: "CATEGORY_DELETED",
      entity: "Category",
      entityId: id,
      details: { name: category.name },
    });
    revalidate();
    return undefined;
  });
}
