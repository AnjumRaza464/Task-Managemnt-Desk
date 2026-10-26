import type { Metadata } from "next";
import Link from "next/link";
import { Clock, LogIn, Timer, Wifi, X } from "lucide-react";
import { requireManagerPage } from "@/lib/auth-guard";
import { getAttendanceDay, type AttendanceStatus } from "@/lib/attendance";
import { formatDuration } from "@/lib/attendance-types";
import { addDays, dayKey, formatClock, formatDayKey, isDayKey } from "@/lib/time-zone";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RoleBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { DayPicker } from "@/components/attendance/day-picker";
import { LocalTime } from "@/components/shared/local-time";

export const metadata: Metadata = { title: "Attendance" };

const STATUS: Record<AttendanceStatus, { label: string; className: string }> = {
  online: {
    label: "Online",
    className:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  },
  away: {
    label: "Idle",
    className:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  },
  out: {
    label: "Checked out",
    className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
  },
  absent: {
    label: "Not checked in",
    className: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-500/15 dark:text-zinc-400 dark:border-zinc-500/30",
  },
};

/** Clock time in the viewer's time zone, server-rendered in APP_TIME_ZONE. */
function ClockTime({ date }: { date: Date | null | undefined }) {
  return <LocalTime date={date} fallback={formatClock(date)} />;
}

export default async function AttendancePage({ searchParams }: PageProps<"/attendance">) {
  await requireManagerPage();
  const params = await searchParams;
  const today = dayKey();
  const date = isDayKey(params.date) && params.date <= today ? params.date : today;
  const userFilter = typeof params.user === "string" ? params.user : "";

  const { rows, sessions, summary } = await getAttendanceDay(date);
  const filteredUser = rows.find((r) => r.id === userFilter);
  const log = filteredUser ? sessions.filter((s) => s.userId === filteredUser.id) : sessions;
  const dateParam = date === today ? "" : `date=${date}`;
  const linkFor = (userId?: string) => {
    const qs = [dateParam, userId ? `user=${userId}` : ""].filter(Boolean).join("&");
    return qs ? `/attendance?${qs}` : "/attendance";
  };

  return (
    <>
      <PageHeader
        title="Attendance"
        description={`${formatDayKey(date)} · check-in, check-out and active time for every user`}
      >
        <DayPicker date={date} prev={addDays(date, -1)} next={addDays(date, 1)} today={today} />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Checked in" value={summary.present} hint={`of ${summary.tracked} users`} icon={LogIn} />
        <StatCard
          label="Online now"
          value={date === today ? summary.online : "—"}
          hint={date === today ? "active in the last 3 min" : "only shown for today"}
          icon={Wifi}
          tone="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard label="Total active time" value={formatDuration(summary.totalActive)} hint="all users combined" icon={Timer} />
        <StatCard label="Average per user" value={formatDuration(summary.avgActive)} hint="among users who checked in" icon={Clock} />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead>Check-out</TableHead>
              <TableHead className="text-right">Active time</TableHead>
              <TableHead className="hidden text-right md:table-cell">On portal</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Sessions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className={cn(r.status === "absent" && "text-muted-foreground", r.id === userFilter && "bg-muted/50")}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {r.sessionCount > 0 ? (
                      <Link href={linkFor(r.id)} className="font-medium text-foreground hover:underline">
                        {r.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{r.name}</span>
                    )}
                    <span className="hidden lg:inline">
                      <RoleBadge role={r.role} />
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.designation ?? r.email}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("font-medium", STATUS[r.status].className)}>
                    {STATUS[r.status].label}
                  </Badge>
                  {r.status === "away" && r.lastActiveAt && (
                    <p className="mt-0.5 text-xs text-muted-foreground">last active <ClockTime date={r.lastActiveAt} /></p>
                  )}
                </TableCell>
                <TableCell className="tabular-nums"><ClockTime date={r.checkIn} /></TableCell>
                <TableCell className="tabular-nums">
                  {r.checkIn && !r.checkOut ? <span className="text-muted-foreground">Still checked in</span> : <ClockTime date={r.checkOut} />}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {r.sessionCount ? formatDuration(r.activeSeconds) : "—"}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
                  {r.sessionCount ? formatDuration(r.spanSeconds) : "—"}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{r.sessionCount || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle>Session log{filteredUser ? ` · ${filteredUser.name}` : ""}</CardTitle>
              <CardDescription>
                Each sign-in, and each return after 30+ minutes idle, starts a session. Click a name above to filter.
              </CardDescription>
            </div>
            {filteredUser && (
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={linkFor()} />}>
                <X /> Show everyone
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {log.length === 0 ? (
            <EmptyState icon={Clock} title="No sessions" description="Nobody signed in to the portal on this day." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Ended</TableHead>
                  <TableHead className="text-right">Active time</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {log.map((s) => {
                  const end = s.endedAt ?? new Date();
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.userName}</TableCell>
                      <TableCell className="tabular-nums">
                        <ClockTime date={s.startedAt} />
                        <span className="ml-1.5 text-xs text-muted-foreground">{s.resumed ? "resumed" : "signed in"}</span>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {s.live ? (
                          <span className="text-emerald-600 dark:text-emerald-400">In progress</span>
                        ) : (
                          <>
                            <ClockTime date={s.endedAt} />
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              {s.endReason === "LOGOUT" ? "signed out" : "went idle"}
                            </span>
                          </>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatDuration(s.activeSeconds)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
                        {formatDuration(Math.round((end.getTime() - s.startedAt.getTime()) / 1000))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
