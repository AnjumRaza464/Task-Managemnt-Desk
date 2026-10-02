import type { Metadata } from "next";
import { requireManagerPage } from "@/lib/auth-guard";
import { syncOverdueTasks } from "@/lib/overdue";
import { getNotifications, getUnreadNotificationCount } from "@/lib/queries/notifications";
import { PageHeader } from "@/components/shared/page-header";
import { NotificationList } from "@/components/notifications/notification-list";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const manager = await requireManagerPage();
  await syncOverdueTasks();
  const params = await searchParams;
  const filter = params.filter === "unread" ? "unread" : "all";
  const [notifications, unreadCount] = await Promise.all([
    getNotifications(manager.id, filter),
    getUnreadNotificationCount(manager.id),
  ]);

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread · assignments, completions, overdue alerts and comments` : "You're all caught up"}
      />
      <NotificationList notifications={notifications} filter={filter} unreadCount={unreadCount} />
    </>
  );
}
