import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  ListTodo,
  Loader,
  Users,
} from "lucide-react";
import { requireManagerPage } from "@/lib/auth-guard";
import { syncOverdueTasks } from "@/lib/overdue";
import { getDashboardData } from "@/lib/queries/dashboard";
import { activityDetail, activityLabel } from "@/lib/activity-format";
import { cn, formatDate, timeAgo } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PriorityBadge, StatusBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { MonthlyChart, PriorityChart, StatusChart, UserChart } from "@/components/dashboard/charts";
import { getInitials } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const manager = await requireManagerPage();
  await syncOverdueTasks();
  const data = await getDashboardData();
  const { stats } = data;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader
        title={`${greeting}, ${manager.name.split(" ")[0]}`}
        description={`${formatDate(new Date(), "EEEE, MMMM d, yyyy")} · here is how the team is doing`}
      >
        <Button variant="outline" nativeButton={false} render={<Link href="/monthly-plans" />}>
          <CalendarDays /> Monthly plans
        </Button>
        <Button nativeButton={false} render={<Link href="/tasks" />}>
          <ListTodo /> All tasks
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active users" value={stats.activeUsers} hint={`${stats.totalUsers} total`} icon={Users} href="/users" />
        <StatCard label="Total tasks" value={stats.totalTasks} hint={`${stats.avgCompletion}% avg. progress`} icon={ListTodo} href="/tasks" />
        <StatCard
          label="Completed"
          value={stats.completed}
          hint={`${stats.completionRate}% completion rate`}
          icon={CheckCircle2}
          tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          href="/tasks?status=COMPLETED"
        />
        <StatCard
          label="In progress"
          value={stats.inProgress}
          icon={Loader}
          tone="bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
          href="/tasks?status=IN_PROGRESS"
        />
        <StatCard label="Pending" value={stats.pending} icon={Clock} href="/tasks?status=PENDING" />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          icon={AlertTriangle}
          tone="bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
          href="/tasks?status=OVERDUE"
        />
        <StatCard label="Due today" value={stats.dueToday} icon={CalendarClock} tone="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" />
        <StatCard label="Due this week" value={stats.dueThisWeek} icon={CalendarDays} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Monthly progress</CardTitle>
            <CardDescription>Tasks by due month for the last six months</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyChart data={data.monthly} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Status breakdown</CardTitle>
            <CardDescription>All tasks across every plan</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusChart counts={data.statusCounts} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Team workload</CardTitle>
            <CardDescription>Assigned tasks per user by status</CardDescription>
          </CardHeader>
          <CardContent>
            {data.users.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No tasks assigned yet.</p>
            ) : (
              <UserChart users={data.users} />
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>By priority</CardTitle>
            <CardDescription>Open and closed tasks by priority</CardDescription>
          </CardHeader>
          <CardContent>
            <PriorityChart counts={data.priorityCounts} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Due soon</CardTitle>
            <CardDescription>Open tasks with the nearest due dates</CardDescription>
          </CardHeader>
          <CardContent>
            {data.dueSoon.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing is due. Nice.</p>
            ) : (
              <ul className="divide-y">
                {data.dueSoon.map((task) => (
                  <li key={task.id} className="flex items-center gap-3 py-2.5">
                    <Avatar className="size-7">
                      <AvatarFallback className="bg-primary/10 text-[10px] text-primary">{getInitials(task.assignee.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <Link href={`/tasks/${task.id}`} className="block truncate text-sm font-medium hover:underline">
                        {task.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {task.assignee.name} ·{" "}
                        <span className={cn(task.status === "OVERDUE" && "font-medium text-rose-600 dark:text-rose-400")}>
                          due {formatDate(task.dueDate, "MMM d")}
                        </span>
                      </p>
                    </div>
                    <PriorityBadge priority={task.priority} className="hidden sm:inline-flex" />
                    <StatusBadge status={task.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" /> Recent activity
            </CardTitle>
            <CardDescription>Latest changes across the workspace</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="divide-y">
                {data.recentActivity.map((a) => {
                  const detail = activityDetail(a.action, a.details);
                  return (
                    <li key={a.id} className="py-2.5 text-sm">
                      <p>
                        <span className="font-medium">{a.actor.name}</span> {activityLabel(a.action)}
                        {a.task && (
                          <>
                            {" on "}
                            <Link href={`/tasks/${a.task.id}`} className="font-medium hover:underline">
                              {a.task.title}
                            </Link>
                          </>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {detail && <span>{detail} · </span>}
                        {timeAgo(a.createdAt)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
