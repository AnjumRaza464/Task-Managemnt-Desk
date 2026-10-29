import "server-only";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { notifyManagers, notifyUsers } from "@/lib/activity";
import { today, todayRange } from "@/lib/dates";

let lastRun = 0;
const MIN_INTERVAL_MS = 60_000;

/**
 * Marks PENDING / IN_PROGRESS tasks whose due date has passed as OVERDUE and
 * raises "overdue" and "due today" notifications (deduplicated) for managers
 * and for the assignee. Cheap enough to call from page loads; throttled to
 * once a minute per server.
 */
export async function syncOverdueTasks(force = false) {
  const now = Date.now();
  if (!force && now - lastRun < MIN_INTERVAL_MS) return;
  lastRun = now;

  const select = { id: true, title: true, dueDate: true, assigneeId: true, assignee: { select: { name: true } } };

  const overdue = await prisma.task.findMany({
    where: { status: { in: ["PENDING", "IN_PROGRESS"] }, dueDate: { lt: today() } },
    select,
  });

  if (overdue.length > 0) {
    await prisma.task.updateMany({
      where: { id: { in: overdue.map((t) => t.id) } },
      data: { status: "OVERDUE" },
    });
    for (const task of overdue) {
      await notifyManagers({
        type: "TASK_OVERDUE",
        title: "Task overdue",
        message: `"${task.title}" assigned to ${task.assignee.name} is overdue.`,
        taskId: task.id,
        dedupeKey: `OVERDUE:${task.id}`,
        excludeUserId: task.assigneeId,
      });
      await notifyUsers({
        userIds: [task.assigneeId],
        type: "TASK_OVERDUE",
        title: "Task overdue",
        message: `"${task.title}" was due ${format(task.dueDate, "MMM d")} and is still open.`,
        taskId: task.id,
        dedupeKey: `OVERDUE:${task.id}`,
      });
    }
  }

  const dueToday = await prisma.task.findMany({
    where: { status: { in: ["PENDING", "IN_PROGRESS"] }, dueDate: todayRange() },
    select,
  });
  const dayKey = format(new Date(), "yyyy-MM-dd");
  for (const task of dueToday) {
    await notifyManagers({
      type: "TASK_DUE_TODAY",
      title: "Task due today",
      message: `"${task.title}" assigned to ${task.assignee.name} is due today.`,
      taskId: task.id,
      dedupeKey: `DUE_TODAY:${task.id}:${dayKey}`,
      excludeUserId: task.assigneeId,
    });
    await notifyUsers({
      userIds: [task.assigneeId],
      type: "TASK_DUE_TODAY",
      title: "Task due today",
      message: `"${task.title}" is due today.`,
      taskId: task.id,
      dedupeKey: `DUE_TODAY:${task.id}:${dayKey}`,
    });
  }
}
