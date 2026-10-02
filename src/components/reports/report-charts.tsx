"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PRIORITY_LABELS, STATUS_COLORS, STATUS_LABELS, TASK_STATUSES } from "@/lib/constants";
import type { Priority, TaskStatus } from "@/generated/prisma/enums";

export { StatusChart, UserChart } from "@/components/dashboard/charts";

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

/** Stacked bars: each priority split by status. */
export function PriorityMatrixChart({ matrix }: { matrix: ({ priority: Priority; total: number } & Record<TaskStatus, number>)[] }) {
  const data = matrix.map((m) => ({ ...m, name: PRIORITY_LABELS[m.priority] }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} barCategoryGap="35%" margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "color-mix(in oklab, var(--color-foreground) 6%, transparent)" }} />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-muted-foreground)" }} iconType="circle" iconSize={8} />
        {TASK_STATUSES.map((s, i) => (
          <Bar
            key={s}
            dataKey={s}
            name={STATUS_LABELS[s]}
            stackId="a"
            fill={STATUS_COLORS[s]}
            stroke="var(--color-card)"
            strokeWidth={1}
            maxBarSize={48}
            radius={i === TASK_STATUSES.length - 1 ? [4, 4, 0, 0] : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
