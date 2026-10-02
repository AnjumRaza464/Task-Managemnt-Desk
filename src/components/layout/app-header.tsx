"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { APP_NAME } from "@/lib/constants";

const TITLES: Array<[string, string]> = [
  ["/dashboard", "Dashboard"],
  ["/users", "Users"],
  ["/monthly-plans", "Monthly Plans"],
  ["/tasks/kanban", "Kanban Board"],
  ["/tasks", "Tasks"],
  ["/calendar", "Calendar"],
  ["/reports", "Reports"],
  ["/notifications", "Notifications"],
  ["/settings", "Settings"],
];

function titleFor(pathname: string) {
  return TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? APP_NAME;
}

export function AppHeader({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <h1 className="text-sm font-medium">{titleFor(pathname)}</h1>
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
          nativeButton={false}
          render={<Link href="/notifications" />}
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex size-2 rounded-full bg-primary ring-2 ring-background" />
          )}
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
