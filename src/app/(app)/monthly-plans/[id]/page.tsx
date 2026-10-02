import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, Building2, Mail } from "lucide-react";
import { requireManagerPage } from "@/lib/auth-guard";
import { syncOverdueTasks } from "@/lib/overdue";
import { defaultDueDateInMonth } from "@/lib/dates";
import { getPlanById } from "@/lib/queries/plans";
import { getTaskFormOptions } from "@/lib/queries/tasks";
import { MONTH_NAMES } from "@/lib/constants";
import { cn, getInitials, monthKey, toDateInputValue } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ActiveBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { PlanDetailsCard } from "@/components/plans/plan-details-card";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TaskTable } from "@/components/tasks/task-table";

export const metadata: Metadata = { title: "Monthly plan" };

export default async function PlanDetailPage({ params }: PageProps<"/monthly-plans/[id]">) {
  await requireManagerPage();
  await syncOverdueTasks();
  const { id } = await params;
  const [plan, options] = await Promise.all([getPlanById(id), getTaskFormOptions()]);
  if (!plan) notFound();

  const monthLabel = `${MONTH_NAMES[plan.month - 1]} ${plan.year}`;
  const backHref = `/monthly-plans?month=${monthKey(plan.year, plan.month)}`;
  const defaultDueDate = toDateInputValue(defaultDueDateInMonth(plan.year, plan.month));

  const tasks = plan.tasks;
  const count = (s: string) => tasks.filter((t) => t.status === s).length;
  const progress = tasks.length ? Math.round(tasks.reduce((sum, t) => sum + t.completion, 0) / tasks.length) : 0;
  const stats = [
    ["Total", tasks.length, ""],
    ["Completed", count("COMPLETED"), "text-emerald-600 dark:text-emerald-400"],
    ["In progress", count("IN_PROGRESS"), "text-sky-600 dark:text-sky-400"],
    ["Pending", count("PENDING"), ""],
    ["Overdue", count("OVERDUE"), "text-rose-600 dark:text-rose-400"],
    ["Progress", `${progress}%`, ""],
  ] as const;

  return (
    <>
      <PageHeader title={`${plan.user.name} · ${monthLabel}`} description={plan.title ?? "Monthly plan"}>
        <Button variant="outline" nativeButton={false} render={<Link href={backHref} />}>
          <ArrowLeft /> All plans
        </Button>
        {plan.user.isActive && (
          <NewTaskButton
            options={options}
            defaults={{ assigneeId: plan.user.id, dueDate: defaultDueDate }}
            label="Add task"
          />
        )}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <div className="space-y-6">
          <Card>
            <CardContent className="flex items-center gap-3">
              <Avatar className="size-12">
                <AvatarFallback className="bg-primary/10 text-primary">{getInitials(plan.user.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <Link href={`/users/${plan.user.id}`} className="block truncate font-medium hover:underline">
                  {plan.user.name}
                </Link>
                <div className="mt-1">
                  <ActiveBadge isActive={plan.user.isActive} />
                </div>
              </div>
            </CardContent>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Mail className="size-4" /> {plan.user.email}
              </p>
              {plan.user.designation && (
                <p className="flex items-center gap-2">
                  <Briefcase className="size-4" /> {plan.user.designation}
                </p>
              )}
              {plan.user.department && (
                <p className="flex items-center gap-2">
                  <Building2 className="size-4" /> {plan.user.department}
                </p>
              )}
            </CardContent>
          </Card>

          <PlanDetailsCard
            plan={{ id: plan.id, title: plan.title, notes: plan.notes }}
            taskCount={tasks.length}
            backHref={backHref}
          />
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {stats.map(([label, value, tone]) => (
              <div key={label} className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={cn("mt-1 text-xl font-semibold tabular-nums", tone)}>{value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold">Tasks in {monthLabel}</h3>
            <TaskTable
              tasks={tasks}
              options={options}
              showAssignee={false}
              sortable={false}
              emptyTitle="No tasks in this plan"
              emptyDescription="Add a task with a due date in this month and it will appear here."
            />
          </div>
        </div>
      </div>
    </>
  );
}
