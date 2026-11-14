/**
 * Where a task opens when clicked anywhere in the app: its project board with
 * the task modal already open (`?task=<id>`), like clicking the card on the
 * Kanban. A task outside any project falls back to its own page.
 */
export function boardHrefFor(taskHref: string): string {
  return taskHref === "/my-tasks" ? "/my-projects" : "/projects";
}

export function taskOpenHref(task: { id: string; projectId?: string | null }, taskHref = "/tasks"): string {
  return task.projectId ? `${boardHrefFor(taskHref)}/${task.projectId}?task=${task.id}` : `${taskHref}/${task.id}`;
}
