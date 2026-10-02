import { today } from "@/lib/dates";
import type { TaskStatus } from "@/generated/prisma/enums";

export type Progress = {
  status: TaskStatus;
  completion: number;
  /** `undefined` = leave as is, `null` = clear, Date = set. */
  completedAt: Date | null | undefined;
};

/** Keeps status, completion and completedAt consistent with each other and the due date. */
export function normalizeProgress(
  status: TaskStatus,
  completion: number,
  dueDate: Date,
  previousStatus?: TaskStatus,
): Progress {
  let nextStatus = status;
  let nextCompletion = completion;

  if (nextStatus === "COMPLETED") nextCompletion = 100;
  else if (nextCompletion === 100 && nextStatus !== "CANCELLED") nextStatus = "COMPLETED";
  else if (nextCompletion > 0 && nextStatus === "PENDING") nextStatus = "IN_PROGRESS";

  if ((nextStatus === "PENDING" || nextStatus === "IN_PROGRESS") && dueDate < today()) {
    nextStatus = "OVERDUE";
  }
  if (nextStatus === "OVERDUE" && dueDate >= today()) {
    nextStatus = nextCompletion > 0 ? "IN_PROGRESS" : "PENDING";
  }

  const completedAt =
    nextStatus === "COMPLETED" ? (previousStatus === "COMPLETED" ? undefined : new Date()) : null;

  return { status: nextStatus, completion: nextCompletion, completedAt };
}

type Existing = { status: TaskStatus; completion: number; dueDate: Date };

/** Progress after an explicit status change (e.g. from a select or a kanban drop). */
export function progressForStatusChange(existing: Existing, status: TaskStatus): Progress {
  const progress = normalizeProgress(status, existing.completion, existing.dueDate, existing.status);
  // Explicit moves out of COMPLETED should reset completion below 100.
  if (existing.status === "COMPLETED" && status !== "COMPLETED" && progress.completion === 100) {
    progress.completion = 90;
    progress.status = status === "CANCELLED" ? "CANCELLED" : existing.dueDate < today() ? "OVERDUE" : status;
  }
  return progress;
}

/** Progress after an explicit completion percentage change (e.g. from a slider). */
export function progressForCompletionChange(existing: Existing, completion: number): Progress {
  let baseStatus = existing.status;
  if (existing.status === "COMPLETED" && completion < 100) baseStatus = "IN_PROGRESS";
  return normalizeProgress(baseStatus, completion, existing.dueDate, existing.status);
}
