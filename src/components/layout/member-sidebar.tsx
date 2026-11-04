"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, FolderKanban, ListTodo } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { BrandLogo, BrandMark } from "@/components/shared/brand-logo";
import { UserMenu } from "@/components/layout/user-menu";
import type { CurrentUser } from "@/lib/auth-guard";

export type SidebarProject = { id: string; name: string; color: string; status: string; openTasks: number };
export type SidebarWorkspace = { id: string; name: string; color: string; projects: SidebarProject[] };

/**
 * Member navigation: their pages on top, then every project they belong to,
 * grouped by workspace (like the reference WorkHub layout).
 */
export function MemberSidebar({ user, workspaces, canManage = false }: { user: CurrentUser; workspaces: SidebarWorkspace[]; canManage?: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/my-tasks" />} className="data-[state=open]:bg-sidebar-accent">
              <BrandMark className="hidden group-data-[collapsible=icon]:block" />
              <BrandLogo className="h-9 group-data-[collapsible=icon]:hidden" />
              <span className="sr-only">{APP_NAME}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {workspaces.length === 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel>Workspaces</SidebarGroupLabel>
            <SidebarGroupContent>
              <p className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                {canManage ? "No workspaces yet. Create one from the Projects page." : "You are not in any project yet."}
              </p>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel>Workspaces</SidebarGroupLabel>
            <SidebarGroupContent>
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

                      {/* Its projects, indented under a connector line. */}
                      <SidebarMenuSub className="mt-1 gap-0.5 border-l-2" style={{ borderLeftColor: ws.color }}>
                        {ws.projects.map((p) => {
                          const active = isActive(`/my-projects/${p.id}`);
                          return (
                            <SidebarMenuSubItem key={p.id}>
                              <SidebarMenuSubButton isActive={active} render={<Link href={`/my-projects/${p.id}`} />} className="h-8">
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
                      </SidebarMenuSub>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <UserMenu user={user} settingsHref={canManage ? "/settings" : null} notificationsHref="/my-notifications" />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
