import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, Building2, Mail, Phone } from "lucide-react";
import { requireManagerPage } from "@/lib/auth-guard";
import { getUserById } from "@/lib/queries/users";
import { getTaskFormOptions, taskListInclude } from "@/lib/queries/tasks";
import { prisma } from "@/lib/prisma";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActiveBadge, RoleBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TaskTable } from "@/components/tasks/task-table";
import { formatDate, getInitials } from "@/lib/utils";

export const metadata: Metadata = { title: "User details" };

export default async function UserDetailPage({ params }: PageProps<"/users/[id]">) {
  await requireManagerPage();
  const { id } = await params;
  const [user, options] = await Promise.all([getUserById(id), getTaskFormOptions()]);
  if (!user) notFound();

  const tasks = await prisma.task.findMany({
    where: { assigneeId: id },
    include: taskListInclude,
    orderBy: [{ dueDate: "desc" }],
  });

  const stat = (label: string, value: number | string, tone = "") => (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );

  return (
    <>
      <PageHeader title={user.name} description={user.designation ?? undefined}>
        <Button variant="outline" nativeButton={false} render={<Link href="/users" />}>
          <ArrowLeft /> Back to users
        </Button>
        {user.isActive && <NewTaskButton options={options} defaults={{ assigneeId: user.id }} label="Assign task" />}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Card>
          <CardHeader className="items-center text-center">
            <Avatar className="size-16">
              <AvatarFallback className="bg-primary/10 text-lg text-primary">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <CardTitle className="mt-2">{user.name}</CardTitle>
            <div className="flex items-center gap-2">
              <RoleBadge role={user.role} />
              <ActiveBadge isActive={user.isActive} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-4" /> {user.email}
            </p>
            {user.phone && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Phone className="size-4" /> {user.phone}
              </p>
            )}
            {user.department && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="size-4" /> {user.department}
              </p>
            )}
            {user.designation && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="size-4" /> {user.designation}
              </p>
            )}
            <p className="pt-2 text-xs text-muted-foreground">Member since {formatDate(user.createdAt)}</p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {stat("Total", user.stats.total)}
            {stat("Completed", user.stats.completed, "text-emerald-600 dark:text-emerald-400")}
            {stat("In progress", user.stats.inProgress, "text-sky-600 dark:text-sky-400")}
            {stat("Pending", user.stats.pending)}
            {stat("Overdue", user.stats.overdue, "text-rose-600 dark:text-rose-400")}
            {stat("Avg. progress", `${user.stats.avgCompletion}%`)}
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold">Assigned tasks</h3>
            <TaskTable
              tasks={tasks}
              options={options}
              showAssignee={false}
              sortable={false}
              emptyTitle="No tasks assigned"
              emptyDescription="Assign a task to this user from a monthly plan."
            />
          </div>
        </div>
      </div>
    </>
  );
}
