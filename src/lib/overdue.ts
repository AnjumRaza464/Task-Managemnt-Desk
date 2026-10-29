import "server-only";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { notifyManagers, notifyUsers } from "@/lib/activity";
import { getAppUrl } from "@/lib/app-url";
import { today, todayRange } from "@/lib/dates";

let lastRun = 0;
const MIN_INTERVAL_MS = 60_000;

/**
 * Marks PENDING / IN_PROGRESS tasks whose due date has passed as OVERDUE and
 * raises "overdue" and "due today" notifications (deduplicated). Managers get
 * them in the app; the assignee gets them in the app and by email.
 * Cheap enough to call from page loads; throttled to once a minute per server.
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
  const dueToday = await prisma.task.findMany({
    where: { status: { in: ["PENDING", "IN_PROGRESS"] }, dueDate: todayRange() },
    select,
  });
  if (overdue.length === 0 && dueToday.length === 0) return;

  const appUrl = await getAppUrl();

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
        email: {
          subject: `Overdue: ${task.title}`,
          heading: "A task is overdue",
          lines: [
            `"${task.title}" was due on ${format(task.dueDate, "EEEE, MMMM d")} and is still open.`,
            "Please update its status or progress, or let your manager know if it is blocked.",
          ],
          cta: { label: "Open task", url: `${appUrl}/tasks/${task.id}` },
        },
      });
    }
  }

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
      email: {
        subject: `Due today: ${task.title}`,
        heading: "A task is due today",
        lines: [`"${task.title}" is due today. Make sure its status and progress are up to date before the day ends.`],
        cta: { label: "Open task", url: `${appUrl}/tasks/${task.id}` },
      },
    });
  }
}
