import { requireMemberPage } from "@/lib/auth-guard";
import { getUnseenFileCount } from "@/lib/queries/files";
import { getUnreadNotificationCount } from "@/lib/queries/notifications";
import { getMyProjects } from "@/lib/queries/projects";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { MemberHeader } from "@/components/layout/member-header";
import { MemberSidebar, type SidebarWorkspace } from "@/components/layout/member-sidebar";
import { ChatWidget } from "@/components/chat/chat-widget";
import { InstallBanner } from "@/components/pwa/install-banner";

export default async function MemberLayout({ children }: LayoutProps<"/">) {
  const user = await requireMemberPage();
  const [unseenFiles, unreadNotifications, projects] = await Promise.all([
    getUnseenFileCount(user.id),
    getUnreadNotificationCount(user.id),
    getMyProjects(user.id),
  ]);

  const workspaces: SidebarWorkspace[] = [];
  const names: Record<string, string> = {};
  for (const p of projects) {
    names[p.id] = p.name;
    let ws = workspaces.find((w) => w.id === p.workspace.id);
    if (!ws) {
      ws = { id: p.workspace.id, name: p.workspace.name, color: p.workspace.color, projects: [] };
      workspaces.push(ws);
    }
    ws.projects.push({ id: p.id, name: p.name, color: p.color, status: p.status, openTasks: p.stats.total - p.stats.completed });
  }

  return (
    <SidebarProvider>
      <MemberSidebar user={user} workspaces={workspaces} unreadNotifications={unreadNotifications} unseenFiles={unseenFiles} />
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
