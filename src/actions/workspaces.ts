"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth-guard";
import { ActionError, runAction } from "@/lib/action-result";
import { logActivity } from "@/lib/activity";
import { workspaceSchema } from "@/lib/validations/project";

function revalidate() {
  revalidatePath("/workspaces");
  revalidatePath("/my-projects");
  revalidatePath("/tasks");
}

export async function createWorkspace(input: unknown) {
  return runAction(async () => {
    const manager = await requireManager();
    const values = workspaceSchema.parse(input);
    const workspace = await prisma.workspace.create({
      data: { name: values.name, description: values.description, color: values.color, createdById: manager.id },
    });
    await logActivity({
      actorId: manager.id,
      action: "WORKSPACE_CREATED",
      entity: "Workspace",
      entityId: workspace.id,
      details: { name: workspace.name },
    });
    revalidate();
    return { id: workspace.id };
  });
}

export async function updateWorkspace(id: string, input: unknown) {
  return runAction(async () => {
    const manager = await requireManager();
    const values = workspaceSchema.parse(input);
    const workspace = await prisma.workspace.update({
      where: { id },
      data: { name: values.name, description: values.description, color: values.color },
    });
    await logActivity({
      actorId: manager.id,
      action: "WORKSPACE_UPDATED",
      entity: "Workspace",
      entityId: workspace.id,
      details: { name: workspace.name },
    });
    revalidate();
    return { id: workspace.id };
  });
}

export async function deleteWorkspace(id: string) {
  return runAction(async () => {
    const manager = await requireManager();
    if (manager.role !== "ADMIN") throw new ActionError("Only admins can delete a workspace.");
    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: { _count: { select: { projects: true } } },
    });
    if (!workspace) throw new ActionError("Workspace not found.");
    // Tasks keep existing (projectId / listId become null); projects, lists, milestones and discussions go.
    await prisma.workspace.delete({ where: { id } });
    await logActivity({
      actorId: manager.id,
      action: "WORKSPACE_DELETED",
      entity: "Workspace",
      entityId: id,
      details: { name: workspace.name, deletedProjects: workspace._count.projects },
    });
    revalidate();
    return { deletedProjects: workspace._count.projects };
  });
}
