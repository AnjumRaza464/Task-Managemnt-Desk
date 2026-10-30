import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { Priority, TaskStatus } from "@/generated/prisma/enums";

const ACTION_LABELS: Record<string, string> = {
  TASK_CREATED: "created this task",
  TASK_UPDATED: "updated the task",
  TASK_REASSIGNED: "reassigned the task",
  TASK_DELETED: "deleted a task",
  STATUS_CHANGED: "changed the status",
  PROGRESS_UPDATED: "updated the progress",
  SUBTASK_ADDED: "added a subtask",
  SUBTASK_UPDATED: "renamed a subtask",
  SUBTASK_COMPLETED: "completed a subtask",
  SUBTASK_REOPENED: "reopened a subtask",
  SUBTASK_DELETED: "removed a subtask",
  COMMENT_ADDED: "commented",
  COMMENT_DELETED: "deleted a comment",
  ATTACHMENT_ADDED: "attached a file",
  ATTACHMENT_DELETED: "removed a file",
  FILE_SHARED: "shared a file",
  FILE_UNSHARED: "removed a shared file",
  USER_CREATED: "created a user",
  USER_UPDATED: "updated a user",
  USER_ACTIVATED: "activated a user",
  USER_DEACTIVATED: "deactivated a user",
  USER_DELETED: "deleted a user",
  PLAN_OPENED: "opened a monthly plan",
  PLAN_UPDATED: "updated a monthly plan",
  PLAN_DELETED: "deleted a monthly plan",
  CATEGORY_CREATED: "created a category",
  CATEGORY_UPDATED: "updated a category",
  CATEGORY_DELETED: "deleted a category",
  PROFILE_UPDATED: "updated their profile",
  PASSWORD_CHANGED: "changed their password",
  TASK_MOVED: "moved the task to another list",
  TASK_RECURRED: "scheduled the next occurrence",
  WORKSPACE_CREATED: "created a workspace",
  WORKSPACE_UPDATED: "updated a workspace",
  WORKSPACE_DELETED: "deleted a workspace",
  PROJECT_CREATED: "created the project",
  PROJECT_UPDATED: "updated the project",
  PROJECT_STATUS_CHANGED: "changed the project status",
  PROJECT_DELETED: "deleted a project",
  PROJECT_MEMBER_ADDED: "added a member",
  PROJECT_MEMBER_REMOVED: "removed a member",
  LIST_CREATED: "added a list",
  LIST_RENAMED: "renamed a list",
  LIST_DELETED: "deleted a list",
  MILESTONE_CREATED: "added a milestone",
  MILESTONE_UPDATED: "updated a milestone",
  MILESTONE_COMPLETED: "completed a milestone",
  MILESTONE_REOPENED: "reopened a milestone",
  MILESTONE_DELETED: "deleted a milestone",
  DEPENDENCY_ADDED: "added a dependency",
  DEPENDENCY_REMOVED: "removed a dependency",
};

type Details = Record<string, unknown> | null | undefined;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function fmt(field: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (field === "status") return STATUS_LABELS[value as TaskStatus] ?? String(value);
  if (field === "priority") return PRIORITY_LABELS[value as Priority] ?? String(value);
  if (field === "dueDate") return formatDate(value as string);
  if (field === "completion") return `${value}%`;
  return String(value);
}

/** Human-readable verb phrase for an activity log row. */
export function activityLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.toLowerCase().replace(/_/g, " ");
}

/** Short secondary line describing what changed (may be empty). */
export function activityDetail(action: string, raw: unknown): string {
  const details = asRecord(raw) as Details;
  if (!details) return "";

  switch (action) {
    case "STATUS_CHANGED":
      return `${fmt("status", details.from)} → ${fmt("status", details.to)}`;
    case "PROGRESS_UPDATED":
      return `${fmt("completion", details.from)} → ${fmt("completion", details.to)}`;
    case "TASK_REASSIGNED": {
      if (details.from && details.to) return `${details.from} → ${details.to}`;
      const changes = asRecord(details.changes);
      const assignee = changes ? asRecord(changes.assignee) : null;
      return assignee ? `${assignee.from} → ${assignee.to}` : "";
    }
    case "TASK_UPDATED": {
      const changes = asRecord(details.changes);
      if (!changes) return "";
      return Object.entries(changes)
        .map(([field, change]) => {
          const c = asRecord(change);
          return c ? `${field}: ${fmt(field, c.from)} → ${fmt(field, c.to)}` : null;
        })
        .filter(Boolean)
        .join(" · ");
    }
    case "COMMENT_ADDED":
    case "COMMENT_REPLIED":
      return typeof details.excerpt === "string" ? `"${details.excerpt}"` : "";
    case "TASK_MOVED":
    case "LIST_RENAMED":
      return details.from && details.to ? `${details.from} → ${details.to}` : "";
    case "PROJECT_STATUS_CHANGED":
      return details.from && details.to ? `${String(details.from).toLowerCase().replace(/_/g, " ")} → ${String(details.to).toLowerCase().replace(/_/g, " ")}` : "";
    case "PROJECT_MEMBER_ADDED":
      return typeof details.name === "string" ? `${details.name}${details.role ? ` as ${String(details.role).toLowerCase()}` : ""}` : "";
    case "DEPENDENCY_ADDED":
    case "DEPENDENCY_REMOVED":
      return typeof details.blocker === "string" ? `waits for "${details.blocker}"` : "";
    case "ATTACHMENT_ADDED":
    case "ATTACHMENT_DELETED":
    case "FILE_SHARED":
    case "FILE_UNSHARED":
      return typeof details.fileName === "string" ? details.fileName : "";
    case "TASK_CREATED":
      return typeof details.assignee === "string" ? `assigned to ${details.assignee}` : "";
    case "SUBTASK_ADDED":
    case "SUBTASK_UPDATED":
    case "SUBTASK_COMPLETED":
    case "SUBTASK_REOPENED":
    case "SUBTASK_DELETED":
    case "TASK_DELETED":
    case "CATEGORY_CREATED":
    case "CATEGORY_UPDATED":
    case "CATEGORY_DELETED":
    case "USER_CREATED":
    case "USER_UPDATED":
    case "USER_ACTIVATED":
    case "USER_DEACTIVATED":
    case "USER_DELETED":
    case "WORKSPACE_CREATED":
    case "WORKSPACE_UPDATED":
    case "WORKSPACE_DELETED":
    case "PROJECT_CREATED":
    case "PROJECT_UPDATED":
    case "PROJECT_DELETED":
    case "PROJECT_MEMBER_REMOVED":
    case "LIST_CREATED":
    case "LIST_DELETED":
    case "MILESTONE_CREATED":
    case "MILESTONE_UPDATED":
    case "MILESTONE_COMPLETED":
    case "MILESTONE_REOPENED":
    case "MILESTONE_DELETED":
      return typeof details.title === "string" ? details.title : typeof details.name === "string" ? details.name : "";
    default:
      return "";
  }
}
