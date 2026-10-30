import type { Metadata } from "next";
import { requireManagerPage } from "@/lib/auth-guard";
import { syncOverdueTasks } from "@/lib/overdue";
import { getWorkspacesOverview } from "@/lib/queries/projects";
import { getAssignableUsers } from "@/lib/queries/users";
import { PageHeader } from "@/components/shared/page-header";
import { WorkspacesOverview } from "@/components/projects/workspaces-overview";

export const metadata: Metadata = { title: "Projects" };

export default async function WorkspacesPage() {
  const manager = await requireManagerPage();
  await syncOverdueTasks();
  const [workspaces, users] = await Promise.all([getWorkspacesOverview(manager), getAssignableUsers()]);
  const projectCount = workspaces.reduce((n, w) => n + w.projects.length, 0);

  return (
    <>
      <PageHeader
        title="Projects"
        description={`${workspaces.length} workspace${workspaces.length === 1 ? "" : "s"} · ${projectCount} project${projectCount === 1 ? "" : "s"} · Workspace → Project → Lists → Tasks`}
      />
      <WorkspacesOverview workspaces={workspaces} users={users} canManage isAdmin={manager.role === "ADMIN"} projectHref="/projects" />
    </>
  );
}
