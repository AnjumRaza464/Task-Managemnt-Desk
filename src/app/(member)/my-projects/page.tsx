import type { Metadata } from "next";
import { FolderKanban } from "lucide-react";
import { requireMemberPage } from "@/lib/auth-guard";
import { syncOverdueTasks } from "@/lib/overdue";
import { getMyProjects } from "@/lib/queries/projects";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectCard } from "@/components/projects/project-card";
import { ProjectRoleBadge } from "@/components/projects/project-status-badge";

export const metadata: Metadata = { title: "My projects" };

export default async function MyProjectsPage() {
  const user = await requireMemberPage();
  await syncOverdueTasks();
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
