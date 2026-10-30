import "server-only";
import { revalidatePath } from "next/cache";
import { notifyUsers } from "@/lib/activity";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export function revalidateProjectViews(projectId?: string) {
  for (const p of ["/workspaces", "/my-projects", "/tasks", "/tasks/kanban", "/dashboard", "/calendar"]) revalidatePath(p);
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/my-projects/${projectId}`);
  }
}

/**
 * Adds users to a project (no-op for existing members) and tells them.
 * Used when creating a project and whenever someone is assigned a task in it.
 */
export async function ensureProjectMembers(
  tx: Tx,
  project: { id: string; name: string },
  userIds: string[],
  actorId: string,
  role: "MEMBER" | "VIEWER" = "MEMBER",
) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return [];
  const existing = await tx.projectMember.findMany({ where: { projectId: project.id, userId: { in: ids } }, select: { userId: true } });
  const have = new Set(existing.map((m) => m.userId));
  const added = ids.filter((id) => !have.has(id));
  if (added.length === 0) return [];
  await tx.projectMember.createMany({
    data: added.map((userId) => ({ projectId: project.id, userId, role, addedById: actorId })),
    skipDuplicates: true,
  });
  await notifyUsers(
    {
      userIds: added,
      type: "PROJECT_ADDED",
      title: "Added to a project",
      message: `You were added to the project "${project.name}".`,
      projectId: project.id,
      excludeUserId: actorId,
    },
    tx,
  );
  return added;
}

/**
 * Checks that a list / milestone belong to the project and returns the ids to
 * store. Throws a plain Error message the caller wraps into an ActionError.
 */
export async function resolveProjectPlacement(
  tx: Tx,
  input: { projectId: string | null; listId: string | null; milestoneId: string | null },
) {
  if (!input.projectId) return { projectId: null, listId: null, milestoneId: null, project: null };
  const project = await tx.project.findUnique({
    where: { id: input.projectId },
    select: { id: true, name: true, status: true, lists: { select: { id: true } }, milestones: { select: { id: true } } },
  });
  if (!project) throw new Error("Project not found.");
  if (project.status === "ARCHIVED" || project.status === "COMPLETED") throw new Error("This project is closed; reopen it to add tasks.");
  const listId = input.listId && project.lists.some((l) => l.id === input.listId) ? input.listId : null;
  const milestoneId = input.milestoneId && project.milestones.some((m) => m.id === input.milestoneId) ? input.milestoneId : null;
  return { projectId: project.id, listId, milestoneId, project: { id: project.id, name: project.name } };
}
