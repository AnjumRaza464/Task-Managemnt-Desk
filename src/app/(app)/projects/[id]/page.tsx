import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireManagerPage } from "@/lib/auth-guard";
import { syncOverdueTasks } from "@/lib/overdue";
import { getProjectForUser, getWorkspaceOptions } from "@/lib/queries/projects";
import { getTaskFormOptions } from "@/lib/queries/tasks";
import { getAssignableUsers } from "@/lib/queries/users";
import { parseProjectTab, ProjectView } from "@/components/projects/project-view";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params, searchParams }: PageProps<"/projects/[id]">) {
  const manager = await requireManagerPage();
  await syncOverdueTasks();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [data, options, users, workspaces] = await Promise.all([
    getProjectForUser(id, manager),
    getTaskFormOptions(manager),
    getAssignableUsers(),
    getWorkspaceOptions(),
  ]);
  if (!data) notFound();

  return (
    <ProjectView
      data={data}
      tab={parseProjectTab(query.tab)}
      user={manager}
      options={options}
      users={users}
      workspaces={workspaces}
      basePath="/projects"
      taskHref="/tasks"
    />
  );
}
