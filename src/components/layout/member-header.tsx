"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { GlobalSearch } from "@/components/layout/global-search";
import { ActivityTracker } from "@/components/attendance/activity-tracker";

const TITLES: Array<[string, string]> = [
  ["/my-tasks", "Dashboard"],
  ["/my-projects", "Projects"],
  ["/my-files", "Files"],
  ["/my-notifications", "Notifications"],
];

export function MemberHeader({ unreadCount, projectNames }: { unreadCount: number; projectNames: Record<string, string> }) {
  const pathname = usePathname();
  const projectId = pathname.match(/^\/my-projects\/([^/]+)/)?.[1];
  const title = (projectId && projectNames[projectId]) || TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] || "UniKyn";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <h1 className="truncate text-sm font-medium">{title}</h1>
      <div className="ml-auto flex items-center gap-1">
        <GlobalSearch scope="member" />
        <ActivityTracker />
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications" nativeButton={false} render={<Link href="/my-notifications" />}>
          <Bell className="size-4" />
          {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 flex size-2 rounded-full bg-primary ring-2 ring-background" />}
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
