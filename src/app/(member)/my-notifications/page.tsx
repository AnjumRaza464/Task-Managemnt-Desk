import type { Metadata } from "next";
import { requireMemberPage } from "@/lib/auth-guard";
import { after } from "next/server";
import { syncOverdueTasks } from "@/lib/overdue";
import { getNotifications, getUnreadNotificationCount } from "@/lib/queries/notifications";
import { getTaskFormOptions } from "@/lib/queries/tasks";
import { getAssignableUsers } from "@/lib/queries/users";
import { PageHeader } from "@/components/shared/page-header";
import { NotificationList } from "@/components/notifications/notification-list";

export const metadata: Metadata = { title: "Notifications" };

export default async function MemberNotificationsPage({ searchParams }: PageProps<"/my-notifications">) {
  const user = await requireMemberPage();
  // Overdue sync runs after the response is sent so it never delays the page.
  after(() => syncOverdueTasks());
  const params = await searchParams;
  const filter = params.filter === "unread" ? "unread" : "all";
  // The task modal needs the people to @mention and, for managers, the form options for Edit.
  const [notifications, unreadCount, users, options] = await Promise.all([
    getNotifications(user.id, filter),
    getUnreadNotificationCount(user.id),
    getAssignableUsers(),
    user.role === "MEMBER" ? Promise.resolve(null) : getTaskFormOptions(user),
  ]);

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
        taskModal={{ users, options }}
      />
    </>
  );
}
