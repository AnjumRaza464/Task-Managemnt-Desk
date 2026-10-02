"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarRange,
  ListTodo,
  KanbanSquare,
  CalendarDays,
  BarChart3,
  Bell,
  Settings,
  CalendarCheck2,
} from "lucide-react";
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
import { UserMenu } from "@/components/layout/user-menu";
import type { CurrentManager } from "@/lib/auth-guard";

const NAV = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Planning",
    items: [
      { title: "Users", href: "/users", icon: Users },
      { title: "Monthly Plans", href: "/monthly-plans", icon: CalendarRange },
      { title: "All Tasks", href: "/tasks", icon: ListTodo, exact: true },
      { title: "Kanban", href: "/tasks/kanban", icon: KanbanSquare },
      { title: "Calendar", href: "/calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Reports", href: "/reports", icon: BarChart3 },
      { title: "Notifications", href: "/notifications", icon: Bell },
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar({
  user,
  unreadCount,
}: {
  user: CurrentManager;
  unreadCount: number;
}) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    if (href === "/tasks") return pathname === "/tasks" || pathname.startsWith("/tasks/") && !pathname.startsWith("/tasks/kanban");
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/dashboard" />}
              className="data-[state=open]:bg-sidebar-accent"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <CalendarCheck2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{APP_NAME}</span>
                <span className="truncate text-xs text-muted-foreground">
                  Task management
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive(item.href, item.exact)}
                      tooltip={item.title}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                    {item.href === "/notifications" && unreadCount > 0 && (
                      <SidebarMenuBadge className="bg-primary text-primary-foreground">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <UserMenu user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
