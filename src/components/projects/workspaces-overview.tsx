"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, FolderPlus, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteWorkspace } from "@/actions/workspaces";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import type { UserOption } from "@/components/shared/user-multi-select";
import { ProjectCard } from "@/components/projects/project-card";
import { ProjectDialog, type ProjectFormValues } from "@/components/projects/project-dialog";
import { WorkspaceDialog, type WorkspaceFormValues } from "@/components/projects/workspace-dialog";
import type { WorkspaceOverview } from "@/lib/queries/projects";

export function WorkspacesOverview({
  workspaces,
  users,
  canManage,
  isAdmin,
  projectHref,
}: {
  workspaces: WorkspaceOverview[];
  users: UserOption[];
  canManage: boolean;
  isAdmin: boolean;
  projectHref: string;
}) {
  const router = useRouter();
  const [wsDialog, setWsDialog] = useState<{ open: boolean; workspace: WorkspaceFormValues | null }>({ open: false, workspace: null });
  const [projectDialog, setProjectDialog] = useState<{ open: boolean; defaults: Partial<ProjectFormValues> }>({ open: false, defaults: {} });
  const [deleting, setDeleting] = useState<WorkspaceOverview | null>(null);
  const wsOptions = workspaces.map((w) => ({ id: w.id, name: w.name, color: w.color }));

  return (
    <>
      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setWsDialog({ open: true, workspace: null })} variant="outline">
            <FolderPlus /> New workspace
          </Button>
          <Button onClick={() => setProjectDialog({ open: true, defaults: { workspaceId: workspaces[0]?.id ?? "" } })} disabled={workspaces.length === 0}>
            <Plus /> New project
          </Button>
        </div>
      )}

      {workspaces.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={canManage ? "No workspaces yet" : "You are not in any project yet"}
          description={
            canManage
              ? "Create a workspace (e.g. Production, Retail, Head office) and add projects to it."
              : "A manager will add you to projects; they will show up here."
          }
          action={
            canManage ? (
              <Button onClick={() => setWsDialog({ open: true, workspace: null })}>
                <FolderPlus /> Create workspace
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          {workspaces.map((ws) => (
            <section key={ws.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: ws.color }} />
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{ws.name}</h3>
                    {ws.description && <p className="truncate text-xs text-muted-foreground">{ws.description}</p>}
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {ws.projects.length} project{ws.projects.length === 1 ? "" : "s"}
                  </span>
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setProjectDialog({ open: true, defaults: { workspaceId: ws.id } })}>
                      <Plus /> Project
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Workspace actions" />}>
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            setWsDialog({ open: true, workspace: { id: ws.id, name: ws.name, description: ws.description ?? "", color: ws.color } })
                          }
                        >
                          <Pencil /> Edit workspace
                        </DropdownMenuItem>
                        {isAdmin && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(ws)}>
                              <Trash2 /> Delete workspace
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>

              {ws.projects.length === 0 ? (
                <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No projects in this workspace yet.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {ws.projects.map((p) => (
                    <ProjectCard key={p.id} project={p} href={`${projectHref}/${p.id}`} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <WorkspaceDialog open={wsDialog.open} onOpenChange={(o) => setWsDialog((d) => ({ ...d, open: o }))} workspace={wsDialog.workspace} />
      <ProjectDialog
        open={projectDialog.open}
        onOpenChange={(o) => setProjectDialog((d) => ({ ...d, open: o }))}
        defaults={projectDialog.defaults}
        workspaces={wsOptions}
        users={users}
        onSaved={(id) => router.push(`${projectHref}/${id}`)}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this workspace?"
        description={`"${deleting?.name}" and its ${deleting?.projects.length ?? 0} project(s), lists, milestones and discussions will be removed. Tasks are kept in their monthly plans.`}
        confirmLabel="Delete workspace"
        onConfirm={async () => {
          if (!deleting) return;
          const result = await deleteWorkspace(deleting.id);
          if (!result.ok) throw new Error(result.error);
          toast.success("Workspace deleted");
          router.refresh();
        }}
      />
    </>
  );
}
