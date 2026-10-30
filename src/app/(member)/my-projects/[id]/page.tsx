import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireMemberPage } from "@/lib/auth-guard";
import { syncOverdueTasks } from "@/lib/overdue";
import { getProjectForUser, getWorkspaceOptions } from "@/lib/queries/projects";
import { getTaskFormOptions } from "@/lib/queries/tasks";
import { getAssignableUsers } from "@/lib/queries/users";
import { parseProjectTab, ProjectView } from "@/components/projects/project-view";

export const metadata: Metadata = { title: "Project" };

export default async function MemberProjectPage({ params, searchParams }: PageProps<"/my-projects/[id]">) {
  const user = await requireMemberPage();
  await syncOverdueTasks();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const data = await getProjectForUser(id, user);
  if (!data) notFound();
  const [options, users, workspaces] = await Promise.all([getTaskFormOptions(user), getAssignableUsers(), getWorkspaceOptions()]);

  return (
    <ProjectView
      data={data}
      tab={parseProjectTab(query.tab)}
      user={user}
      options={options}
      users={users}
      workspaces={workspaces}
      basePath="/my-projects"
      taskHref="/my-tasks"
    />
  );
}
