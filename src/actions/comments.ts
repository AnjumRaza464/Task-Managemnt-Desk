"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { UnauthorizedError } from "@/lib/auth-guard";
import { ActionError, runAction } from "@/lib/action-result";
import { logActivity, notifyManagers, notifyUsers } from "@/lib/activity";
import { MAX_ATTACHMENT_BYTES } from "@/lib/constants";
import { getProjectAccess, requireProjectAccess, requireTaskAccess, requireUser } from "@/lib/permissions";
import { commentSchema } from "@/lib/validations/task";

const BLOCKED_EXTENSIONS = /\.(exe|bat|cmd|sh|msi|dll|js|jar|ps1|vbs)$/i;
const MAX_FILES_PER_COMMENT = 10;

/** The files appended as "file" to a comment form, checked against the size and type limits. */
function commentFiles(formData: FormData): File[] {
  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_FILES_PER_COMMENT) throw new ActionError(`Attach up to ${MAX_FILES_PER_COMMENT} files per comment.`);
  let total = 0;
  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_BYTES) throw new ActionError(`"${file.name}" is larger than 5 MB.`);
    if (BLOCKED_EXTENSIONS.test(file.name)) throw new ActionError(`"${file.name}" is not an allowed file type.`);
    total += file.size;
  }
  if (total > MAX_ATTACHMENT_BYTES) throw new ActionError("All files of one comment together must stay under 5 MB.");
  return files;
}

function revalidateComments(taskId: string | null, projectId: string | null) {
  if (taskId) {
    revalidatePath(`/tasks/${taskId}`);
    revalidatePath(`/my-tasks/${taskId}`);
  }
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/my-projects/${projectId}`);
  }
  revalidatePath("/notifications");
}

/**
 * Posts a comment (or a reply) on a task or in a project discussion, with
 * any files appended as "file" (pictures show inline). Mentioned people, the
 * parent comment's author, the task's assignees / the project's members and
 * managers are notified, each only once.
 */
export async function addComment(formData: FormData) {
  return runAction(async () => {
    const files = commentFiles(formData);
    const values = commentSchema.parse({
      taskId: formData.get("taskId") || undefined,
      projectId: formData.get("projectId") || undefined,
      parentId: formData.get("parentId") || undefined,
      content: String(formData.get("content") ?? ""),
      mentionIds: JSON.parse(String(formData.get("mentionIds") ?? "[]")),
    });
    if (!values.content && files.length === 0) throw new ActionError("Write a comment or attach a file.");
    const fileLabel = files.length === 1 ? `📎 ${files[0].name}` : `📎 ${files.length} files`;
    const excerpt = (values.content || fileLabel).slice(0, 80);

    // Where does the comment go, and may the user post there?
    let user;
    let task: { id: string; title: string; projectId: string | null; assignees: { userId: string }[] } | null = null;
    let project: { id: string; name: string; members: { userId: string }[] } | null = null;
    if (values.taskId) {
      const result = await requireTaskAccess(values.taskId, "canComment");
      user = result.user;
      task = await prisma.task.findUnique({
        where: { id: values.taskId },
        select: { id: true, title: true, projectId: true, assignees: { select: { userId: true } } },
      });
      if (!task) throw new ActionError("Task not found.");
    } else if (values.projectId) {
      const result = await requireProjectAccess(values.projectId, "comment");
      user = result.user;
      project = await prisma.project.findUnique({
        where: { id: values.projectId },
        select: { id: true, name: true, members: { select: { userId: true } } },
      });
      if (!project) throw new ActionError("Project not found.");
    } else {
      throw new ActionError("Pick a task or a project to comment on.");
    }

    // Replies stay one level deep: replying to a reply attaches to its parent.
    let parentId: string | null = null;
    let parentAuthorId: string | null = null;
    if (values.parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: values.parentId },
        select: { id: true, parentId: true, authorId: true, taskId: true, projectId: true },
      });
      if (!parent) throw new ActionError("The comment you are replying to no longer exists.");
      if ((task && parent.taskId !== task.id) || (project && parent.projectId !== project.id)) {
        throw new ActionError("That comment belongs to a different discussion.");
      }
      parentId = parent.parentId ?? parent.id;
      parentAuthorId = parent.authorId;
    }

    const mentionIds = values.mentionIds.filter((id) => id !== user.id);
    const mentioned = mentionIds.length
      ? await prisma.user.findMany({ where: { id: { in: mentionIds }, isActive: true }, select: { id: true, name: true } })
      : [];

    const uploads = await Promise.all(files.map(async (file) => ({ file, bytes: Buffer.from(await file.arrayBuffer()) })));

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          taskId: task?.id ?? null,
          projectId: project?.id ?? null,
          parentId,
          authorId: user.id,
          content: values.content,
          mentions: { create: mentioned.map((m) => ({ userId: m.id })) },
          ...(uploads.length
            ? {
                attachments: {
                  create: uploads.map(({ file, bytes }) => ({
                    taskId: task?.id ?? null,
                    projectId: task ? null : (project?.id ?? null),
                    uploadedById: user.id,
                    fileName: file.name.slice(0, 200),
                    mimeType: file.type || "application/octet-stream",
                    size: file.size,
                    data: bytes,
                  })),
                },
              }
            : {}),
        },
      });
      await logActivity(
        {
          actorId: user.id,
          action: parentId ? "COMMENT_REPLIED" : "COMMENT_ADDED",
          entity: "Comment",
          entityId: created.id,
          taskId: task?.id ?? null,
          projectId: task?.projectId ?? project?.id ?? null,
          details: { excerpt, mentions: mentioned.map((m) => m.name), file: files.length ? files.map((f) => f.name).join(", ") : undefined },
        },
        tx,
      );

      const where = task ? `"${task.title}"` : `the ${project!.name} discussion`;
      const link = { taskId: task?.id ?? null, projectId: task ? null : (project?.id ?? null) };
      const notified = new Set<string>([user.id]);

      // 1. Mentions.
      const mentionTargets = await notifyUsers(
        {
          userIds: mentioned.map((m) => m.id),
          type: "MENTIONED",
          title: "You were mentioned",
          message: `${user.name} mentioned you in ${where}: "${excerpt}"`,
          ...link,
          excludeUserIds: [...notified],
        },
        tx,
      );
      for (const id of mentionTargets) notified.add(id);

      // 2. The person being replied to.
      if (parentAuthorId && !notified.has(parentAuthorId)) {
        await notifyUsers(
          {
            userIds: [parentAuthorId],
            type: "COMMENT_ADDED",
            title: "New reply",
            message: `${user.name} replied to your comment in ${where}.`,
            ...link,
            excludeUserIds: [...notified],
          },
          tx,
        );
        notified.add(parentAuthorId);
      }

      // 3. Everyone else who follows this discussion.
      if (task) {
        const assigneeTargets = await notifyUsers(
          {
            userIds: task.assignees.map((a) => a.userId),
            type: "COMMENT_ADDED",
            title: "New comment on your task",
            message: `${user.name} commented on "${task.title}".`,
            taskId: task.id,
            excludeUserIds: [...notified],
          },
          tx,
        );
        for (const id of assigneeTargets) notified.add(id);
        await notifyManagers(
          {
            type: "COMMENT_ADDED",
            title: "New comment",
            message: `${user.name} commented on "${task.title}".`,
            taskId: task.id,
            excludeUserIds: [...notified],
          },
          tx,
        );
      } else if (project) {
        await notifyUsers(
          {
            userIds: project.members.map((m) => m.userId),
            type: "COMMENT_ADDED",
            title: `New post in ${project.name}`,
            message: `${user.name}: "${excerpt}"`,
            projectId: project.id,
            excludeUserIds: [...notified],
          },
          tx,
        );
      }
      return created;
    });

    revalidateComments(task?.id ?? null, task?.projectId ?? project?.id ?? null);
    return { id: comment.id };
  });
}

export async function deleteComment(id: string) {
  return runAction(async () => {
    const user = await requireUser();
    const comment = await prisma.comment.findUnique({
      where: { id },
      select: { id: true, taskId: true, projectId: true, authorId: true, task: { select: { projectId: true } } },
    });
    if (!comment) throw new ActionError("Comment not found.");

    let allowed = comment.authorId === user.id || user.role !== "MEMBER";
    if (!allowed) {
      const projectId = comment.projectId ?? comment.task?.projectId ?? null;
      const access = projectId ? await getProjectAccess(user, projectId) : null;
      allowed = Boolean(access?.canManage);
    }
    if (!allowed) throw new UnauthorizedError("You can only delete your own comments.");

    await prisma.$transaction([
      // Files posted in a project discussion live only in that comment (or its replies); task files stay with the task.
      prisma.attachment.deleteMany({ where: { taskId: null, OR: [{ commentId: id }, { comment: { parentId: id } }] } }),
      prisma.comment.delete({ where: { id } }), // replies cascade
    ]);
    await logActivity({
      actorId: user.id,
      action: "COMMENT_DELETED",
      entity: "Comment",
      entityId: id,
      taskId: comment.taskId,
      projectId: comment.projectId ?? comment.task?.projectId ?? null,
    });
    revalidateComments(comment.taskId, comment.projectId ?? comment.task?.projectId ?? null);
    return undefined;
  });
}
