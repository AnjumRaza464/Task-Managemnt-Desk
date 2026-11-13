import type { Metadata } from "next";
import { FolderKanban } from "lucide-react";
import { requireMemberPage } from "@/lib/auth-guard";
import { after } from "next/server";
import { syncOverdueTasks } from "@/lib/overdue";
import { getMyProjects, getWorkspaceOptions, getWorkspacesOverview } from "@/lib/queries/projects";
import { getAssignableUsers } from "@/lib/queries/users";
import { WorkspacesOverview } from "@/components/projects/workspaces-overview";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectCard } from "@/components/projects/project-card";
import { ProjectRoleBadge } from "@/components/projects/project-status-badge";

export const metadata: Metadata = { title: "My projects" };

export default async function MyProjectsPage() {
  const user = await requireMemberPage();
  // Overdue sync runs after the response is sent so it never delays the page.
  after(() => syncOverdueTasks());

  if (user.role === "MANAGER") {
    const [workspaces, users, workspaceOptions] = await Promise.all([getWorkspacesOverview(user), getAssignableUsers(), getWorkspaceOptions()]);
    const projectCount = workspaces.reduce((n, w) => n + w.projects.length, 0);
    return (
      <>
        <PageHeader
          title="Projects"
          description={`${workspaces.length} workspace${workspaces.length === 1 ? "" : "s"} · ${projectCount} project${projectCount === 1 ? "" : "s"}`}
        />
        <WorkspacesOverview workspaces={workspaces} users={users} canManage isAdmin={false} projectHref="/my-projects" workspaceOptions={workspaceOptions} />
      </>
    );
  }

  const projects = await getMyProjects(user.id);

  const byWorkspace = new Map<string, { name: string; color: string; projects: typeof projects }>();
  for (const p of projects) {
    const entry = byWorkspace.get(p.workspace.id) ?? { name: p.workspace.name, color: p.workspace.color, projects: [] };
    entry.projects.push(p);
    byWorkspace.set(p.workspace.id, entry);
  }

  return (
    <>
      <PageHeader title="My projects" description={`${projects.length} project${projects.length === 1 ? "" : "s"} you are a member of`} />
      {projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects yet" description="When a manager adds you to a project it will show up here." />
      ) : (
        <div className="space-y-8">
          {[...byWorkspace.entries()].map(([id, ws]) => (
            <section key={id} className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="size-3 rounded-full" style={{ backgroundColor: ws.color }} />
                <h3 className="text-base font-semibold">{ws.name}</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {ws.projects.map((p) => (
                  <div key={p.id} className="relative">
                    <ProjectCard project={p} href={`/my-projects/${p.id}`} className="h-full pt-9" />
                    <ProjectRoleBadge role={p.myRole} className="absolute top-3 right-3" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
