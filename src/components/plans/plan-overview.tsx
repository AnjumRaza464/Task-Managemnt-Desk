"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, FolderOpen, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { ensurePlan } from "@/actions/plans";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { RoleBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { cn, getInitials } from "@/lib/utils";
import type { MonthOverviewRow } from "@/lib/queries/plans";
import type { TaskFormOptions } from "@/lib/queries/tasks";

export function PlanOverview({
  rows,
  year,
  month,
  defaultDueDate,
  options,
}: {
  rows: MonthOverviewRow[];
  year: number;
  month: number;
  defaultDueDate: string;
  options: TaskFormOptions;
}) {
  const router = useRouter();
  const [startingId, setStartingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function startPlan(userId: string) {
    setStartingId(userId);
    startTransition(async () => {
      const result = await ensurePlan({ userId, year, month });
      setStartingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/monthly-plans/${result.data.id}`);
    });
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No active users"
        description="Add team members on the Users page to start planning their month."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => {
        const s = row.stats;
        const stats = [
          ["Total", s.total, ""],
          ["Done", s.completed, "text-emerald-600 dark:text-emerald-400"],
          ["Active", s.inProgress, "text-sky-600 dark:text-sky-400"],
          ["Overdue", s.overdue, "text-rose-600 dark:text-rose-400"],
        ] as const;

        return (
          <Card key={row.id}>
            <CardContent className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarFallback className="bg-primary/10 text-primary">{getInitials(row.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <Link href={`/users/${row.id}`} className="block truncate font-medium hover:underline">
                  {row.name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {row.designation ?? row.department ?? row.email}
                </p>
              </div>
              <RoleBadge role={row.role} />
            </CardContent>

            <CardContent className="space-y-3">
              {row.plan ? (
                <>
                  {row.plan.title && <p className="truncate text-sm text-muted-foreground">{row.plan.title}</p>}
                  <div className="grid grid-cols-4 gap-2">
                    {stats.map(([label, value, tone]) => (
                      <div key={label} className="rounded-lg bg-muted/60 px-2 py-1.5 text-center">
                        <p className={cn("text-base font-semibold tabular-nums", tone)}>{value}</p>
                        <p className="text-[11px] text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span className="tabular-nums">{s.progress}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${s.progress}%` }} />
                    </div>
                  </div>
                </>
              ) : (
                <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                  No plan for this month yet.
                </p>
              )}
            </CardContent>

            <CardFooter className="gap-2">
              {row.plan ? (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/monthly-plans/${row.plan.id}`} />}
                >
                  <FolderOpen /> Open plan
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => startPlan(row.id)} disabled={startingId === row.id}>
                  {startingId === row.id ? <Loader2 className="animate-spin" /> : <CalendarPlus />} Start plan
                </Button>
              )}
              <NewTaskButton
                options={options}
                defaults={{ assigneeId: row.id, dueDate: defaultDueDate }}
                label="Assign task"
                size="sm"
                variant="ghost"
              />
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
