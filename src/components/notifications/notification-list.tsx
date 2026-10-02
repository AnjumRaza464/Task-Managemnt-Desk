"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BellOff,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  Info,
  Loader2,
  MessageSquare,
  Trash2,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  clearReadNotifications,
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import type { NotificationType } from "@/generated/prisma/enums";

type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  task: { id: string; title: string } | null;
};

const ICONS: Record<NotificationType, { icon: LucideIcon; tone: string }> = {
  TASK_ASSIGNED: { icon: UserPlus, tone: "bg-primary/10 text-primary" },
  TASK_COMPLETED: { icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  TASK_OVERDUE: { icon: AlertTriangle, tone: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  TASK_DUE_TODAY: { icon: CalendarClock, tone: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  COMMENT_ADDED: { icon: MessageSquare, tone: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  SYSTEM: { icon: Info, tone: "bg-muted text-muted-foreground" },
};

export function NotificationList({
  notifications,
  filter,
  unreadCount,
}: {
  notifications: Notification[];
  filter: "all" | "unread";
  unreadCount: number;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkPending, startBulk] = useTransition();
  const [, startTransition] = useTransition();
  const readCount = notifications.filter((n) => n.isRead).length;

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    startBulk(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      if (success) toast.success(success);
      router.refresh();
    });
  }

  function toggleRead(n: Notification) {
    setBusyId(n.id);
    startTransition(async () => {
      const result = await markNotificationRead(n.id, !n.isRead);
      setBusyId(null);
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }

  function remove(n: Notification) {
    setBusyId(n.id);
    startTransition(async () => {
      const result = await deleteNotification(n.id);
      setBusyId(null);
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border p-0.5">
          {(["all", "unread"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "secondary" : "ghost"}
              nativeButton={false}
              render={<Link href={f === "all" ? "/notifications" : "/notifications?filter=unread"} />}
            >
              {f === "all" ? "All" : `Unread${unreadCount ? ` (${unreadCount})` : ""}`}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={bulkPending || unreadCount === 0}
            onClick={() => run(markAllNotificationsRead, "All notifications marked as read")}
          >
            <CheckCheck /> Mark all read
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={bulkPending || readCount === 0}
            onClick={() => run(clearReadNotifications, "Read notifications cleared")}
          >
            <Trash2 /> Clear read
          </Button>
        </div>
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={filter === "unread" ? "You're all caught up" : "No notifications"}
          description={
            filter === "unread"
              ? "New notifications will appear here when tasks are assigned, completed or become overdue."
              : "Task assignments, completions, overdue alerts and comments will show up here."
          }
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {notifications.map((n) => {
            const { icon: Icon, tone } = ICONS[n.type];
            const busy = busyId === n.id;
            return (
              <li
                key={n.id}
                className={cn("flex items-start gap-3 px-4 py-3 transition-colors", !n.isRead && "bg-primary/[0.03]")}
              >
                <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", tone)}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {!n.isRead && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                    <p className={cn("text-sm", !n.isRead && "font-medium")}>{n.title}</p>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground" title={formatDateTime(n.createdAt)}>
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                  {n.task && (
                    <Link
                      href={`/tasks/${n.task.id}`}
                      onClick={() => {
                        if (!n.isRead) void markNotificationRead(n.id, true);
                      }}
                      className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
                    >
                      Open task →
                    </Link>
                  )}
                </div>
                <div className="flex shrink-0 items-center">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={n.isRead ? "Mark as unread" : "Mark as read"}
                    title={n.isRead ? "Mark as unread" : "Mark as read"}
                    disabled={busy}
                    onClick={() => toggleRead(n)}
                  >
                    {busy ? <Loader2 className="animate-spin" /> : n.isRead ? <CheckCheck className="text-muted-foreground" /> : <CheckCircle2 />}
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Delete notification"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={busy}
                    onClick={() => remove(n)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
