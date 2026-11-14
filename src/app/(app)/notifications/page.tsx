import type { Metadata } from "next";
import { requireManagerPage } from "@/lib/auth-guard";
import { after } from "next/server";
import { syncOverdueTasks } from "@/lib/overdue";
import { getNotifications, getUnreadNotificationCount } from "@/lib/queries/notifications";
import { getTaskFormOptions } from "@/lib/queries/tasks";
import { getAssignableUsers } from "@/lib/queries/users";
import { PageHeader } from "@/components/shared/page-header";
import { NotificationList } from "@/components/notifications/notification-list";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const manager = await requireManagerPage();
  // Overdue sync runs after the response is sent so it never delays the page.
  after(() => syncOverdueTasks());
  const params = await searchParams;
  const filter = params.filter === "unread" ? "unread" : "all";
  // "Open task" lands on the project board with the task modal open, so the modal's users and form options come along.
  const [notifications, unreadCount, users, options] = await Promise.all([
    getNotifications(manager.id, filter),
    getUnreadNotificationCount(manager.id),
    getAssignableUsers(),
    getTaskFormOptions(manager),
  ]);

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread · assignments, completions, overdue alerts and comments` : "You're all caught up"}
      />
      <NotificationList notifications={notifications} filter={filter} unreadCount={unreadCount} taskModal={{ users, options }} boardHref="/projects" />
    </>
  );
}
