import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, Infinity as InfinityIcon } from "lucide-react";
import { requireManagerPage } from "@/lib/auth-guard";
import { syncOverdueTasks } from "@/lib/overdue";
import {
  getMonthlyReport,
  getPriorityReport,
  getStatusReport,
  getUserPerformanceReport,
  type ReportScope,
} from "@/lib/queries/reports";
import { getTaskFormOptions } from "@/lib/queries/tasks";
import { MONTH_NAMES, PRIORITY_LABELS, STATUS_LABELS, TASK_STATUSES } from "@/lib/constants";
import { cn, monthKey, parseMonthKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActiveBadge, PriorityBadge, StatusBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { MonthPicker } from "@/components/plans/month-picker";
import { ExportButtons } from "@/components/reports/export-buttons";
import { PriorityMatrixChart, StatusChart, UserChart } from "@/components/reports/report-charts";
import { TaskTable } from "@/components/tasks/task-table";

export const metadata: Metadata = { title: "Reports" };

const REPORTS = [
  { key: "monthly", label: "Monthly", description: "Every task in the period with its status and progress" },
  { key: "users", label: "User performance", description: "Workload and completion rate per team member" },
  { key: "status", label: "By status", description: "Completed, pending and overdue breakdown" },
  { key: "priority", label: "By priority", description: "How work is distributed across priorities" },
] as const;
type ReportKey = (typeof REPORTS)[number]["key"];

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  await requireManagerPage();
  await syncOverdueTasks();
  const params = await searchParams;
  const report: ReportKey = REPORTS.some((r) => r.key === params.report) ? (params.report as ReportKey) : "monthly";
  const allTime = params.scope === "all";
  const { year, month } = parseMonthKey(typeof params.month === "string" ? params.month : undefined);
  const scope: ReportScope = allTime ? { year, month, all: true } : { year, month };
  const scopeParam = allTime ? "all" : monthKey(year, month);
  const scopeLabel = allTime ? "All time" : `${MONTH_NAMES[month - 1]} ${year}`;
  const current = REPORTS.find((r) => r.key === report)!;

  const linkFor = (key: ReportKey) => `/reports?report=${key}${allTime ? "&scope=all" : `&month=${monthKey(year, month)}`}`;

  return (
    <>
      <PageHeader title="Reports" description={`${current.description} · ${scopeLabel}`}>
        {allTime ? (
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/reports?report=${report}&month=${monthKey(year, month)}`} />}>
            <CalendarRange /> Pick a month
          </Button>
        ) : (
          <>
            <MonthPicker year={year} month={month} />
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/reports?report=${report}&scope=all`} />}>
              <InfinityIcon /> All time
            </Button>
          </>
        )}
        <ExportButtons report={report} scope={scopeParam} />
      </PageHeader>

      <nav className="flex flex-wrap gap-1 rounded-lg bg-muted p-1 sm:w-fit" aria-label="Report type">
        {REPORTS.map((r) => (
          <Link
            key={r.key}
            href={linkFor(r.key)}
            aria-current={r.key === report ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              r.key === report && "bg-background text-foreground shadow-xs",
            )}
          >
            {r.label}
          </Link>
        ))}
      </nav>

      {report === "monthly" && <MonthlyReport scope={scope} />}
      {report === "users" && <UsersReport scope={scope} />}
      {report === "status" && <StatusReport scope={scope} />}
      {report === "priority" && <PriorityReport scope={scope} />}
    </>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums", tone)}>{value}</p>
    </div>
  );
}

async function MonthlyReport({ scope }: { scope: ReportScope }) {
  const [{ tasks, summary }, options] = await Promise.all([getMonthlyReport(scope), getTaskFormOptions()]);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Total" value={summary.total} />
        <Stat label="Completed" value={summary.completed} tone="text-emerald-600 dark:text-emerald-400" />
        <Stat label="In progress" value={summary.inProgress} tone="text-sky-600 dark:text-sky-400" />
        <Stat label="Pending" value={summary.pending} />
        <Stat label="Overdue" value={summary.overdue} tone="text-rose-600 dark:text-rose-400" />
        <Stat label="Completion rate" value={`${summary.completionRate}%`} />
      </div>
      <TaskTable tasks={tasks} options={options} sortable={false} emptyTitle="No tasks in this period" emptyDescription="Try another month or switch to all time." />
    </>
  );
}

async function UsersReport({ scope }: { scope: ReportScope }) {
  const users = await getUserPerformanceReport(scope);
  const withTasks = users.filter((u) => u.total > 0);
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Workload by user</CardTitle>
          <CardDescription>Assigned tasks split by status</CardDescription>
        </CardHeader>
        <CardContent>
          {withTasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No tasks in this period.</p>
          ) : (
            <UserChart users={withTasks} />
          )}
        </CardContent>
      </Card>
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="hidden md:table-cell">Department</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Done</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Active</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Pending</TableHead>
              <TableHead className="text-right">Overdue</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Critical / High</TableHead>
              <TableHead className="text-right">Completion</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Avg progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} className={!u.isActive ? "opacity-60" : undefined}>
                <TableCell>
                  <Link href={`/users/${u.id}`} className="font-medium hover:underline">
                    {u.name}
                  </Link>
                  <span className="ml-2 inline-block align-middle">{!u.isActive && <ActiveBadge isActive={false} />}</span>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{u.department ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{u.total}</TableCell>
                <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">{u.completed}</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{u.inProgress}</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{u.pending}</TableCell>
                <TableCell className={cn("text-right tabular-nums", u.overdue > 0 && "text-rose-600 dark:text-rose-400")}>{u.overdue}</TableCell>
                <TableCell className="hidden text-right tabular-nums lg:table-cell">
                  {u.critical} / {u.high}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${u.completionRate}%` }} />
                    </div>
                    <span className="w-9 text-xs tabular-nums text-muted-foreground">{u.completionRate}%</span>
                  </div>
                </TableCell>
                <TableCell className="hidden text-right tabular-nums lg:table-cell">{u.avgProgress}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

async function StatusReport({ scope }: { scope: ReportScope }) {
  const [{ tasks, byStatus, total }, options] = await Promise.all([getStatusReport(scope), getTaskFormOptions()]);
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status breakdown</CardTitle>
            <CardDescription>{total} tasks in this period</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusChart counts={byStatus} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>Counts and share of total</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Tasks</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {TASK_STATUSES.map((s) => (
                  <TableRow key={s}>
                    <TableCell>
                      <StatusBadge status={s} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{byStatus[s]}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {total ? Math.round((byStatus[s] / total) * 100) : 0}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <TaskTable tasks={tasks} options={options} sortable={false} emptyTitle="No tasks in this period" />
    </>
  );
}

async function PriorityReport({ scope }: { scope: ReportScope }) {
  const [{ tasks, matrix, total }, options] = await Promise.all([getPriorityReport(scope), getTaskFormOptions()]);
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Priority × status</CardTitle>
            <CardDescription>{total} tasks in this period</CardDescription>
          </CardHeader>
          <CardContent>
            <PriorityMatrixChart matrix={matrix} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Matrix</CardTitle>
            <CardDescription>Task counts per priority and status</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  {TASK_STATUSES.map((s) => (
                    <TableHead key={s} className="text-right">
                      {STATUS_LABELS[s]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrix.map((m) => (
                  <TableRow key={m.priority}>
                    <TableCell>
                      <PriorityBadge priority={m.priority} />
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{m.total}</TableCell>
                    {TASK_STATUSES.map((s) => (
                      <TableCell key={s} className="text-right tabular-nums text-muted-foreground">
                        {m[s]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-xs text-muted-foreground">
              {matrix.map((m) => `${PRIORITY_LABELS[m.priority]}: ${m.total}`).join(" · ")}
            </p>
          </CardContent>
        </Card>
      </div>
      <TaskTable tasks={tasks} options={options} sortable={false} emptyTitle="No tasks in this period" />
    </>
  );
}
