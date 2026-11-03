"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ActionError, runAction } from "@/lib/action-result";
import { logActivity, notifyManagers, notifyUsers } from "@/lib/activity";
import { MAX_ATTACHMENT_BYTES } from "@/lib/constants";
import { requireTaskAccess } from "@/lib/permissions";
import type { CommentKind } from "@/generated/prisma/enums";

const BLOCKED_EXTENSIONS = /\.(exe|bat|cmd|sh|msi|dll|js|jar|ps1|vbs)$/i;
const KIND = z.enum(["CHAT", "DISCUSSION"]);

const messageSchema = z.object({
  taskId: z.string().min(1),
  kind: KIND.default("CHAT"),
  parentId: z.string().min(1).optional(),
  content: z.string().trim().max(2000),
  mentionIds: z.array(z.string().min(1)).max(25).default([]),
});

export type TaskMessageAttachment = { id: string; fileName: string; mimeType: string; size: number };
export type TaskMessage = {
  id: string;
  kind: CommentKind;
  parentId: string | null;
  content: string;
  createdAt: string;
  author: { id: string; name: string };
  mentions: { userId: string }[];
  attachments: TaskMessageAttachment[];
};

const messageInclude = {
  author: { select: { id: true, name: true } },
  mentions: { select: { userId: true } },
  attachments: { select: { id: true, fileName: true, mimeType: true, size: true }, orderBy: { createdAt: "asc" as const } },
};

type Row = {
  id: string;
  kind: CommentKind;
  parentId: string | null;
  content: string;
  createdAt: Date;
  author: { id: string; name: string };
  mentions: { userId: string }[];
  attachments: TaskMessageAttachment[];
};

const toDto = (c: Row): TaskMessage => ({ ...c, createdAt: c.createdAt.toISOString() });

/**
 * Posts a chat message or a discussion comment on a task, optionally with one
 * attached file (stored with the task's attachments too).
 */
export async function postTaskMessage(formData: FormData) {
  return runAction(async () => {
    const values = messageSchema.parse({
      taskId: formData.get("taskId"),
      kind: formData.get("kind") ?? "CHAT",
      parentId: formData.get("parentId") || undefined,
      content: String(formData.get("content") ?? ""),
      mentionIds: JSON.parse(String(formData.get("mentionIds") ?? "[]")),
    });
    const file = formData.get("file");
    const hasFile = file instanceof File && file.size > 0;
    if (!values.content && !hasFile) throw new ActionError("Write a message or attach a file.");
    if (hasFile) {
      if (file.size > MAX_ATTACHMENT_BYTES) throw new ActionError("File is larger than 5 MB.");
      if (BLOCKED_EXTENSIONS.test(file.name)) throw new ActionError("This file type is not allowed.");
    }

    const { user } = await requireTaskAccess(values.taskId, "canComment");
    const task = await prisma.task.findUnique({
      where: { id: values.taskId },
      select: { id: true, title: true, projectId: true, assignees: { select: { userId: true } } },
    });
    if (!task) throw new ActionError("Task not found.");

    let parentId: string | null = null;
    let parentAuthorId: string | null = null;
    if (values.parentId && values.kind === "DISCUSSION") {
      const parent = await prisma.comment.findUnique({ where: { id: values.parentId }, select: { id: true, parentId: true, authorId: true, taskId: true } });
      if (!parent || parent.taskId !== task.id) throw new ActionError("That comment belongs to a different task.");
      parentId = parent.parentId ?? parent.id;
      parentAuthorId = parent.authorId;
    }

    const mentionIds = values.mentionIds.filter((id) => id !== user.id);
    const mentioned = mentionIds.length
      ? await prisma.user.findMany({ where: { id: { in: mentionIds }, isActive: true }, select: { id: true, name: true } })
      : [];
    const bytes = hasFile ? Buffer.from(await file.arrayBuffer()) : null;
    const label = hasFile && !values.content ? `📎 ${file.name}` : values.content;
    const excerpt = label.slice(0, 80);

    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          taskId: task.id,
          parentId,
          kind: values.kind,
          authorId: user.id,
          content: values.content,
          mentions: { create: mentioned.map((m) => ({ userId: m.id })) },
          ...(hasFile && bytes
            ? {
                attachments: {
                  create: {
                    taskId: task.id,
                    uploadedById: user.id,
                    fileName: file.name.slice(0, 200),
                    mimeType: file.type || "application/octet-stream",
                    size: file.size,
                    data: bytes,
                  },
                },
              }
            : {}),
        },
        include: messageInclude,
      });

      await logActivity(
        {
          actorId: user.id,
          action: values.kind === "CHAT" ? "CHAT_MESSAGE" : parentId ? "COMMENT_REPLIED" : "COMMENT_ADDED",
          entity: "Comment",
          entityId: created.id,
          taskId: task.id,
          projectId: task.projectId,
          details: { excerpt, file: hasFile ? file.name : undefined },
        },
        tx,
      );

      const notified = new Set<string>([user.id]);
      const where = `"${task.title}"`;
      const mentionTargets = await notifyUsers(
        {
          userIds: mentioned.map((m) => m.id),
          type: "MENTIONED",
          title: "You were mentioned",
          message: `${user.name} mentioned you in ${where}: "${excerpt}"`,
          taskId: task.id,
          excludeUserIds: [...notified],
        },
        tx,
      );
      for (const id of mentionTargets) notified.add(id);

      if (parentAuthorId && !notified.has(parentAuthorId)) {
        await notifyUsers(
          { userIds: [parentAuthorId], type: "COMMENT_ADDED", title: "New reply", message: `${user.name} replied to your comment in ${where}.`, taskId: task.id, excludeUserIds: [...notified] },
          tx,
        );
        notified.add(parentAuthorId);
      }

      if (values.kind === "CHAT") {
        // One "new messages" notification per task per hour so a busy chat does not flood the inbox.
        const hour = new Date().toISOString().slice(0, 13);
        await notifyUsers(
          {
            userIds: task.assignees.map((a) => a.userId),
            type: "COMMENT_ADDED",
            title: "New message in task chat",
            message: `${user.name} wrote in ${where}: "${excerpt}"`,
            taskId: task.id,
            excludeUserIds: [...notified],
            dedupeKey: `CHAT:${task.id}:${hour}`,
          },
          tx,
        );
      } else {
        const assigneeTargets = await notifyUsers(
          { userIds: task.assignees.map((a) => a.userId), type: "COMMENT_ADDED", title: "New comment on your task", message: `${user.name} commented on ${where}.`, taskId: task.id, excludeUserIds: [...notified] },
          tx,
        );
        for (const id of assigneeTargets) notified.add(id);
        await notifyManagers(
          { type: "COMMENT_ADDED", title: "New comment", message: `${user.name} commented on ${where}.`, taskId: task.id, excludeUserIds: [...notified] },
          tx,
        );
      }
      return created;
    });

    revalidatePath(`/tasks/${task.id}`);
    revalidatePath(`/my-tasks/${task.id}`);
    if (task.projectId) {
      revalidatePath(`/projects/${task.projectId}`);
      revalidatePath(`/my-projects/${task.projectId}`);
    }
    return toDto(message);
  });
}

const fetchSchema = z.object({
  taskId: z.string().min(1),
  kind: KIND,
  since: z.iso.datetime().optional(),
});

/** Messages of one kind on a task, oldest first (optionally only those after `since`). */
export async function getTaskMessages(input: unknown) {
  return runAction(async () => {
    const { taskId, kind, since } = fetchSchema.parse(input);
    await requireTaskAccess(taskId, "canView");
    const rows = await prisma.comment.findMany({
      where: { taskId, kind, ...(since ? { createdAt: { gt: new Date(since) } } : {}) },
      orderBy: { createdAt: "asc" },
      take: 300,
      include: messageInclude,
    });
    return { now: new Date().toISOString(), messages: rows.map(toDto) };
  });
}
