import "server-only";
import { revalidatePath } from "next/cache";

/** Revalidates every page that lists tasks, plus the task's own pages. */
export function revalidateTaskViews(taskId?: string) {
  const paths = [
    "/dashboard",
    "/tasks",
    "/tasks/kanban",
    "/calendar",
    "/monthly-plans",
    "/reports",
    "/users",
    "/notifications",
    "/my-tasks",
    "/workspaces",
    "/my-projects",
  ];
  for (const p of paths) revalidatePath(p);
  if (taskId) {
    revalidatePath(`/tasks/${taskId}`);
    revalidatePath(`/my-tasks/${taskId}`);
  }
}
