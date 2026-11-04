import { requireMemberPage } from "@/lib/auth-guard";
import { getUnreadNotificationCount } from "@/lib/queries/notifications";
import { getMyProjects, getWorkspacesOverview } from "@/lib/queries/projects";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { MemberHeader } from "@/components/layout/member-header";
import { MemberSidebar, type SidebarWorkspace } from "@/components/layout/member-sidebar";
import { ChatWidget } from "@/components/chat/chat-widget";
import { InstallBanner } from "@/components/pwa/install-banner";

export default async function MemberLayout({ children }: LayoutProps<"/">) {
  const user = await requireMemberPage();
  const isManager = user.role === "MANAGER";
  const [unreadNotifications, projects, all] = await Promise.all([
    getUnreadNotificationCount(user.id),
    isManager ? Promise.resolve([]) : getMyProjects(user.id),
    isManager ? getWorkspacesOverview(user) : Promise.resolve([]),
  ]);

  const workspaces: SidebarWorkspace[] = [];
  const names: Record<string, string> = {};
  if (isManager) {
    // Managers see every workspace, even empty ones, so they can add projects.
    for (const w of all) {
      workspaces.push({
        id: w.id,
        name: w.name,
        color: w.color,
        projects: w.projects.map((p) => {
          names[p.id] = p.name;
          return { id: p.id, name: p.name, color: p.color, status: p.status, openTasks: p.stats.total - p.stats.completed };
        }),
      });
    }
  } else {
    for (const p of projects) {
      names[p.id] = p.name;
      let ws = workspaces.find((w) => w.id === p.workspace.id);
      if (!ws) {
        ws = { id: p.workspace.id, name: p.workspace.name, color: p.workspace.color, projects: [] };
        workspaces.push(ws);
      }
      ws.projects.push({ id: p.id, name: p.name, color: p.color, status: p.status, openTasks: p.stats.total - p.stats.completed });
    }
  }

  return (
    <SidebarProvider>
      <MemberSidebar user={user} workspaces={workspaces} canManage={isManager} />
      <SidebarInset>
        <MemberHeader unreadCount={unreadNotifications} projectNames={names} />
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
          <InstallBanner />
          {children}
        </div>
      </SidebarInset>
      <ChatWidget currentUser={user} />
    </SidebarProvider>
  );
}
