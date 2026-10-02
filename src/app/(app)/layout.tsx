import { requireManagerPage } from "@/lib/auth-guard";
import { getUnreadNotificationCount } from "@/lib/queries/notifications";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const manager = await requireManagerPage();
  const unreadCount = await getUnreadNotificationCount(manager.id);

  return (
    <SidebarProvider>
      <AppSidebar user={manager} unreadCount={unreadCount} />
      <SidebarInset>
        <AppHeader unreadCount={unreadCount} />
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
