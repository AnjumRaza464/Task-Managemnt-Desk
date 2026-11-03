"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, FolderKanban, FolderOpen, LayoutDashboard, ListTodo } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { APP_NAME } from "@/lib/constants";
import { BrandLogo, BrandMark } from "@/components/shared/brand-logo";
import { UserMenu } from "@/components/layout/user-menu";
import { NavLinkIcon } from "@/components/layout/nav-pending";
import type { CurrentUser } from "@/lib/auth-guard";

export type SidebarProject = { id: string; name: string; color: string; status: string; openTasks: number };
export type SidebarWorkspace = { id: string; name: string; color: string; projects: SidebarProject[] };

/**
 * Member navigation: their pages on top, then every project they belong to,
 * grouped by workspace (like the reference WorkHub layout).
 */
export function MemberSidebar({
  user,
  workspaces,
  unreadNotifications,
  unseenFiles,
}: {
  user: CurrentUser;
  workspaces: SidebarWorkspace[];
  unreadNotifications: number;
  unseenFiles: number;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const badge = (n: number) =>
    n > 0 ? <SidebarMenuBadge className="bg-primary text-primary-foreground">{n > 99 ? "99+" : n}</SidebarMenuBadge> : null;

  const top = [
    { title: "Dashboard", href: "/my-tasks", icon: LayoutDashboard, count: 0 },
    { title: "All projects", href: "/my-projects", icon: FolderKanban, count: 0 },
    { title: "Files", href: "/my-files", icon: FolderOpen, count: unseenFiles },
    { title: "Notifications", href: "/my-notifications", icon: Bell, count: unreadNotifications },
  ];

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
        <SidebarGroup>
          <SidebarGroupLabel>My work</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {top.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={item.href === "/my-projects" ? pathname === "/my-projects" : isActive(item.href)}
                    tooltip={item.title}
                    render={<Link href={item.href} />}
                  >
                    <NavLinkIcon icon={item.icon} />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                  {badge(item.count)}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {workspaces.length === 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel>Projects</SidebarGroupLabel>
            <SidebarGroupContent>
              <p className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                You are not in any project yet.
              </p>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          workspaces.map((ws) => (
            <SidebarGroup key={ws.id}>
              <SidebarGroupLabel className="gap-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: ws.color }} />
                <span className="truncate">{ws.name}</span>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {ws.projects.map((p) => (
                    <SidebarMenuItem key={p.id}>
                      <SidebarMenuButton
                        isActive={isActive(`/my-projects/${p.id}`)}
                        tooltip={p.name}
                        render={<Link href={`/my-projects/${p.id}`} />}
                      >
                        <span className="flex size-4 items-center justify-center">
                          <span className="size-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
                        </span>
                        <span className="truncate">{p.name}</span>
                      </SidebarMenuButton>
                      {p.openTasks > 0 && (
                        <SidebarMenuBadge className="text-muted-foreground">
                          <ListTodo className="size-3" /> {p.openTasks}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>

      <SidebarFooter>
        <UserMenu user={user} settingsHref={null} notificationsHref="/my-notifications" />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
