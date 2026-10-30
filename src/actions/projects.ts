"use server";

import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth-guard";
import { ActionError, runAction } from "@/lib/action-result";
import { logActivity, notifyUsers } from "@/lib/activity";
import { parseDateInput } from "@/lib/dates";
import { requireProjectAccess } from "@/lib/permissions";
import { ensureProjectMembers, revalidateProjectViews as revalidateProject } from "@/lib/project-members";
import { projectMemberSchema, projectSchema, removeMemberSchema } from "@/lib/validations/project";

const DEFAULT_LISTS = ["To do", "In progress", "Done"];

export async function createProject(input: unknown) {
  return runAction(async () => {
    const manager = await requireManager();
    const values = projectSchema.parse(input);
    const workspace = await prisma.workspace.findUnique({ where: { id: values.workspaceId }, select: { id: true } });
    if (!workspace) throw new ActionError("Workspace not found.");

    const project = await prisma.$transaction(async (tx) => {
      const last = await tx.project.aggregate({ _max: { position: true }, where: { workspaceId: values.workspaceId } });
      const created = await tx.project.create({
        data: {
          workspaceId: values.workspaceId,
          name: values.name,
          description: values.description,
          color: values.color,
          status: values.status,
          startDate: values.startDate ? parseDateInput(values.startDate) : null,
          dueDate: values.dueDate ? parseDateInput(values.dueDate) : null,
          position: (last._max.position ?? 0) + 1,
          createdById: manager.id,
          lists: { create: DEFAULT_LISTS.map((name, position) => ({ name, position })) },
          members: { create: { userId: manager.id, role: "OWNER", addedById: manager.id } },
        },
      });
      await ensureProjectMembers(tx, created, values.memberIds.filter((id) => id !== manager.id), manager.id);
      await logActivity(
        {
          actorId: manager.id,
          action: "PROJECT_CREATED",
          entity: "Project",
          entityId: created.id,
          projectId: created.id,
          details: { name: created.name },
        },
        tx,
      );
      return created;
    });

    await revalidateProject(project.id);
    return { id: project.id };
  });
}

export async function updateProject(id: string, input: unknown) {
  return runAction(async () => {
    const { user } = await requireProjectAccess(id, "manage");
    const values = projectSchema.parse(input);
    const existing = await prisma.project.findUnique({ where: { id }, select: { id: true, name: true, status: true, workspaceId: true } });
    if (!existing) throw new ActionError("Project not found.");
    if (existing.workspaceId !== values.workspaceId && user.role === "MEMBER") {
      throw new ActionError("Only managers can move a project to another workspace.");
    }

    const project = await prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id },
        data: {
          workspaceId: values.workspaceId,
          name: values.name,
          description: values.description,
          color: values.color,
          status: values.status,
          startDate: values.startDate ? parseDateInput(values.startDate) : null,
          dueDate: values.dueDate ? parseDateInput(values.dueDate) : null,
        },
      });
      // Tasks follow the project when it moves between workspaces (nothing to do: tasks reference the project).
      await ensureProjectMembers(tx, updated, values.memberIds, user.id);
      await logActivity(
        {
          actorId: user.id,
          action: existing.status !== updated.status ? "PROJECT_STATUS_CHANGED" : "PROJECT_UPDATED",
          entity: "Project",
          entityId: id,
          projectId: id,
          details: { name: updated.name, from: existing.status, to: updated.status },
        },
        tx,
      );
      return updated;
    });

    await revalidateProject(project.id);
    return { id: project.id };
  });
}

export async function deleteProject(id: string) {
  return runAction(async () => {
    const manager = await requireManager();
    const project = await prisma.project.findUnique({ where: { id }, include: { _count: { select: { tasks: true } } } });
    if (!project) throw new ActionError("Project not found.");
    await prisma.$transaction(async (tx) => {
      // Tasks survive (they still live in monthly plans); they just lose their project, list and milestone.
      await tx.project.delete({ where: { id } });
      await logActivity(
        {
          actorId: manager.id,
          action: "PROJECT_DELETED",
          entity: "Project",
          entityId: id,
          details: { name: project.name, detachedTasks: project._count.tasks },
        },
        tx,
      );
    });
    await revalidateProject();
    return { detachedTasks: project._count.tasks };
  });
}

export async function addProjectMember(input: unknown) {
  return runAction(async () => {
    const values = projectMemberSchema.parse(input);
    const { user, access } = await requireProjectAccess(values.projectId, "manage");
    if (values.role === "OWNER" && !access.isGlobalManager && access.role !== "OWNER") {
      throw new ActionError("Only owners can add other owners.");
    }
    const [project, target] = await Promise.all([
      prisma.project.findUnique({ where: { id: values.projectId }, select: { id: true, name: true } }),
      prisma.user.findUnique({ where: { id: values.userId }, select: { id: true, name: true, isActive: true } }),
    ]);
    if (!project) throw new ActionError("Project not found.");
    if (!target?.isActive) throw new ActionError("That user is inactive.");

    await prisma.$transaction(async (tx) => {
      await tx.projectMember.upsert({
        where: { projectId_userId: { projectId: project.id, userId: target.id } },
        update: { role: values.role },
        create: { projectId: project.id, userId: target.id, role: values.role, addedById: user.id },
      });
      await notifyUsers(
        {
          userIds: [target.id],
          type: "PROJECT_ADDED",
          title: "Added to a project",
          message: `${user.name} added you to "${project.name}" as ${values.role.toLowerCase()}.`,
          projectId: project.id,
          excludeUserId: user.id,
        },
        tx,
      );
      await logActivity(
        {
          actorId: user.id,
          action: "PROJECT_MEMBER_ADDED",
          entity: "Project",
          entityId: project.id,
          projectId: project.id,
          details: { name: target.name, role: values.role },
        },
        tx,
      );
    });
    await revalidateProject(project.id);
    return undefined;
  });
}

export async function removeProjectMember(input: unknown) {
  return runAction(async () => {
    const values = removeMemberSchema.parse(input);
    const { user } = await requireProjectAccess(values.projectId, "manage");
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: values.projectId, userId: values.userId } },
      include: { user: { select: { name: true } } },
    });
    if (!member) throw new ActionError("That person is not a member of this project.");
    if (member.role === "OWNER") {
      const owners = await prisma.projectMember.count({ where: { projectId: values.projectId, role: "OWNER" } });
      if (owners <= 1 && user.role === "MEMBER") throw new ActionError("A project needs at least one owner.");
    }
    await prisma.$transaction(async (tx) => {
      await tx.projectMember.delete({ where: { projectId_userId: { projectId: values.projectId, userId: values.userId } } });
      await logActivity(
        {
          actorId: user.id,
          action: "PROJECT_MEMBER_REMOVED",
          entity: "Project",
          entityId: values.projectId,
          projectId: values.projectId,
          details: { name: member.user.name },
        },
        tx,
      );
    });
    await revalidateProject(values.projectId);
    return undefined;
  });
}
