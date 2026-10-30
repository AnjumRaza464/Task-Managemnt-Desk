import type { Metadata } from "next";
import { requireMemberPage } from "@/lib/auth-guard";
import { syncOverdueTasks } from "@/lib/overdue";
import { getNotifications, getUnreadNotificationCount } from "@/lib/queries/notifications";
import { PageHeader } from "@/components/shared/page-header";
import { NotificationList } from "@/components/notifications/notification-list";

export const metadata: Metadata = { title: "Notifications" };

export default async function MemberNotificationsPage({ searchParams }: PageProps<"/my-notifications">) {
  const user = await requireMemberPage();
  await syncOverdueTasks();
  const params = await searchParams;
  const filter = params.filter === "unread" ? "unread" : "all";
  const [notifications, unreadCount] = await Promise.all([getNotifications(user.id, filter), getUnreadNotificationCount(user.id)]);

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread · assignments, mentions, comments, project updates and reminders` : "You're all caught up"}
      />
      <NotificationList
        notifications={notifications}
        filter={filter}
        unreadCount={unreadCount}
        taskHref="/my-tasks"
        projectHref="/my-projects"
        basePath="/my-notifications"
      />
    </>
  );
}
