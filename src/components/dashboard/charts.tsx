"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PRIORITIES, PRIORITY_COLORS, PRIORITY_LABELS, STATUS_COLORS, STATUS_LABELS, TASK_STATUSES } from "@/lib/constants";
import type { Priority, TaskStatus } from "@/generated/prisma/enums";

const AXIS = { fontSize: 11, fill: "var(--color-muted-foreground)" } as const;
const GRID = "color-mix(in oklab, var(--color-foreground) 10%, transparent)";
const TOOLTIP_STYLE = {
  backgroundColor: "var(--color-popover)",
  color: "var(--color-popover-foreground)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  padding: "6px 10px",
} as const;
const CURSOR = { fill: "color-mix(in oklab, var(--color-foreground) 6%, transparent)" };
const LEGEND_STYLE = { fontSize: 12, color: "var(--color-muted-foreground)" } as const;

/** Grouped bars: total vs completed vs overdue per month (last 6 months by due date). */
export function MonthlyChart({ data }: { data: { label: string; total: number; completed: number; overdue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={CURSOR} />
        <Legend wrapperStyle={LEGEND_STYLE} iconType="circle" iconSize={8} />
        <Bar dataKey="total" name="Total" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="completed" name="Completed" fill={STATUS_COLORS.COMPLETED} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="overdue" name="Overdue" fill={STATUS_COLORS.OVERDUE} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Donut of task counts by status, with a legend/table beside it so identity is never color-alone. */
export function StatusChart({ counts }: { counts: Record<TaskStatus, number> }) {
  const data = TASK_STATUSES.map((status) => ({ status, name: STATUS_LABELS[status], value: counts[status] }));
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex items-center gap-4">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={52}
              outerRadius={80}
              paddingAngle={2}
              stroke="var(--color-card)"
              strokeWidth={2}
            >
              {data.map((d) => (
                <Cell key={d.status} fill={STATUS_COLORS[d.status]} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.status} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.status] }} />
            <span className="flex-1 text-muted-foreground">{d.name}</span>
            <span className="tabular-nums">{d.value}</span>
            <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
              {total ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal stacked bars: per-user task counts by status. */
export function UserChart({
  users,
}: {
  users: { name: string; completed: number; inProgress: number; pending: number; overdue: number }[];
}) {
  const height = Math.max(160, users.length * 36 + 40);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={users} layout="vertical" barCategoryGap="30%" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={88} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={CURSOR} />
        <Legend wrapperStyle={LEGEND_STYLE} iconType="circle" iconSize={8} />
        <Bar dataKey="completed" name="Completed" stackId="a" fill={STATUS_COLORS.COMPLETED} stroke="var(--color-card)" strokeWidth={1} />
        <Bar dataKey="inProgress" name="In progress" stackId="a" fill={STATUS_COLORS.IN_PROGRESS} stroke="var(--color-card)" strokeWidth={1} />
        <Bar dataKey="pending" name="Pending" stackId="a" fill={STATUS_COLORS.PENDING} stroke="var(--color-card)" strokeWidth={1} />
        <Bar dataKey="overdue" name="Overdue" stackId="a" fill={STATUS_COLORS.OVERDUE} stroke="var(--color-card)" strokeWidth={1} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Bars of task counts by priority. */
export function PriorityChart({ counts }: { counts: Record<Priority, number> }) {
  const data = PRIORITIES.map((priority) => ({ priority, name: PRIORITY_LABELS[priority], value: counts[priority] }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} barCategoryGap="35%" margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={CURSOR} />
        <Bar dataKey="value" name="Tasks" radius={[4, 4, 0, 0]} maxBarSize={40} label={{ position: "top", fontSize: 11, fill: "var(--color-muted-foreground)" }}>
          {data.map((d) => (
            <Cell key={d.priority} fill={PRIORITY_COLORS[d.priority]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
