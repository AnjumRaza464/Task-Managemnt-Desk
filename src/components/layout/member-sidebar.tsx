"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, FolderKanban, FolderPlus, ListTodo, Plus } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { BrandLogo, BrandMark } from "@/components/shared/brand-logo";
import { UserMenu } from "@/components/layout/user-menu";
import { ProjectDialog, type ProjectFormValues } from "@/components/projects/project-dialog";
import { WorkspaceDialog } from "@/components/projects/workspace-dialog";
import type { UserOption } from "@/components/shared/user-multi-select";
import type { CurrentUser } from "@/lib/auth-guard";

export type SidebarProject = { id: string; name: string; color: string; status: string; openTasks: number };
export type SidebarWorkspace = { id: string; name: string; color: string; projects: SidebarProject[] };

/**
 * Workspace-area navigation: the section pages on top, then every project the
 * user belongs to, grouped by workspace (like the reference WorkHub layout).
 * Managers see every workspace and can create workspaces and projects from here.
 */
export function MemberSidebar({
  user,
  workspaces,
  canManage = false,
  users = [],
}: {
  user: CurrentUser;
  workspaces: SidebarWorkspace[];
  canManage?: boolean;
  /** People a manager can add to a new project. */
  users?: UserOption[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const [wsDialogOpen, setWsDialogOpen] = useState(false);
  const [projectDialog, setProjectDialog] = useState<{ open: boolean; defaults: Partial<ProjectFormValues> }>({ open: false, defaults: {} });
  const wsOptions = workspaces.map((w) => ({ id: w.id, name: w.name, color: w.color }));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* The logo goes back to My tasks, the page shown after signing in. */}
        <Link href="/my-tasks" className="flex h-12 items-center rounded-md px-2 transition-colors hover:bg-sidebar-accent" aria-label={`${APP_NAME} home`} title="Home">
          <BrandMark className="hidden group-data-[collapsible=icon]:block" />
          <BrandLogo className="h-9 group-data-[collapsible=icon]:hidden" />
          <span className="sr-only">{APP_NAME}</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>

        <SidebarGroup>
          <SidebarGroupLabel>Workspaces</SidebarGroupLabel>
          {canManage && (
            <SidebarGroupAction title="New workspace" onClick={() => setWsDialogOpen(true)}>
              <FolderPlus />
              <span className="sr-only">New workspace</span>
            </SidebarGroupAction>
          )}
          <SidebarGroupContent>
            {workspaces.length === 0 ? (
              <div className="px-2 group-data-[collapsible=icon]:hidden">
                {canManage ? (
                  <>
                    <p className="text-xs text-muted-foreground">No workspaces yet. Create one and add projects to it.</p>
                    <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setWsDialogOpen(true)}>
                      <FolderPlus /> New workspace
                    </Button>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">You are not in any project yet.</p>
                )}
              </div>
            ) : (
              <SidebarMenu className="gap-3">
                {workspaces.map((ws) => {
                  const wsActive = ws.projects.some((p) => isActive(`/my-projects/${p.id}`));
                  return (
                    <SidebarMenuItem key={ws.id}>
                      {/* Workspace header: a department / team that owns the projects below it. */}
                      <SidebarMenuButton
                        size="lg"
                        tooltip={ws.name}
                        className={cn("cursor-default rounded-lg border bg-sidebar-accent/40 hover:bg-sidebar-accent/60", wsActive && "border-primary/30")}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md text-white" style={{ backgroundColor: ws.color }}>
                          <Building2 className="size-4" />
                        </span>
                        <span className="grid flex-1 text-left leading-tight">
                          <span className="truncate text-sm font-semibold">{ws.name}</span>
                          <span className="truncate text-[11px] text-muted-foreground">
                            Workspace · {ws.projects.length} project{ws.projects.length === 1 ? "" : "s"}
                          </span>
                        </span>
                      </SidebarMenuButton>
                      {canManage && (
                        <SidebarMenuAction
                          title={`New project in ${ws.name}`}
                          className="right-2"
                          onClick={() => setProjectDialog({ open: true, defaults: { workspaceId: ws.id } })}
                        >
                          <Plus />
                          <span className="sr-only">New project in {ws.name}</span>
                        </SidebarMenuAction>
                      )}

                      {/* Its projects, indented under a connector line. */}
                      <SidebarMenuSub className="mt-1 gap-0.5 border-l-2" style={{ borderLeftColor: ws.color }}>
                        {ws.projects.map((p) => {
                          const active = isActive(`/my-projects/${p.id}`);
                          return (
                            <SidebarMenuSubItem key={p.id}>
                              <SidebarMenuSubButton isActive={active} render={<Link href={`/my-projects/${p.id}`} prefetch />} className="h-8">
                                <FolderKanban className="size-4" style={{ color: p.color }} />
                                <span className="flex-1 truncate">{p.name}</span>
                                {p.openTasks > 0 && (
                                  <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground">
                                    <ListTodo className="size-3" /> {p.openTasks}
                                  </span>
                                )}
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                        {canManage && ws.projects.length === 0 && (
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton
                              render={<button type="button" />}
                              className="h-8 w-full text-muted-foreground"
                              onClick={() => setProjectDialog({ open: true, defaults: { workspaceId: ws.id } })}
                            >
                              <Plus className="size-4" />
                              <span className="flex-1 truncate">New project</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )}
                      </SidebarMenuSub>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <UserMenu user={user} settingsHref={canManage ? "/settings" : null} notificationsHref="/my-notifications" />
      </SidebarFooter>
      <SidebarRail />

      {canManage && (
        <>
          <WorkspaceDialog open={wsDialogOpen} onOpenChange={setWsDialogOpen} />
          <ProjectDialog
            open={projectDialog.open}
            onOpenChange={(o) => setProjectDialog((d) => ({ ...d, open: o }))}
            defaults={projectDialog.defaults}
            workspaces={wsOptions}
            users={users}
            onSaved={(id) => router.push(`/my-projects/${id}`)}
          />
        </>
      )}
    </Sidebar>
  );
}
