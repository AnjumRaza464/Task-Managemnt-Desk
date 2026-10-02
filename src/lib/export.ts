import "server-only";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import { PRIORITY_LABELS, STATUS_LABELS, TASK_STATUSES } from "@/lib/constants";
import {
  getMonthlyReport,
  getPriorityReport,
  getStatusReport,
  getUserPerformanceReport,
  type ReportScope,
} from "@/lib/queries/reports";
import type { TaskListItem } from "@/lib/queries/tasks";

export type ReportKind = "monthly" | "users" | "status" | "priority";
export type ExportFormat = "csv" | "xlsx";

export const REPORT_KINDS: ReportKind[] = ["monthly", "users", "status", "priority"];

type Cell = string | number | null | undefined;
export type Sheet = { name: string; headers: string[]; rows: Cell[][] };

const d = (value: Date | null | undefined) => (value ? format(value, "yyyy-MM-dd") : "");

const TASK_HEADERS = [
  "Title",
  "Assignee",
  "Category",
  "Priority",
  "Status",
  "Completion %",
  "Start date",
  "Due date",
  "Completed at",
  "Subtasks done",
  "Subtasks total",
  "Plan month",
];

function taskRow(t: TaskListItem): Cell[] {
  return [
    t.title,
    t.assignee.name,
    t.category?.name ?? "",
    PRIORITY_LABELS[t.priority],
    STATUS_LABELS[t.status],
    t.completion,
    d(t.startDate),
    d(t.dueDate),
    d(t.completedAt),
    t.subtasks.filter((s) => s.isCompleted).length,
    t._count.subtasks,
    `${t.plan.year}-${String(t.plan.month).padStart(2, "0")}`,
  ];
}

/** Builds the sheet(s) for a report. The first sheet is what the CSV export contains. */
export async function buildReportSheets(kind: ReportKind, scope: ReportScope): Promise<Sheet[]> {
  switch (kind) {
    case "monthly": {
      const { tasks, summary } = await getMonthlyReport(scope);
      return [
        { name: "Tasks", headers: TASK_HEADERS, rows: tasks.map(taskRow) },
        {
          name: "Summary",
          headers: ["Metric", "Value"],
          rows: [
            ["Total tasks", summary.total],
            ["Completed", summary.completed],
            ["In progress", summary.inProgress],
            ["Pending", summary.pending],
            ["Overdue", summary.overdue],
            ["Cancelled", summary.cancelled],
            ["Completion rate %", summary.completionRate],
            ["Average progress %", summary.avgProgress],
          ],
        },
      ];
    }
    case "users": {
      const users = await getUserPerformanceReport(scope);
      return [
        {
          name: "User performance",
          headers: [
            "Name",
            "Email",
            "Department",
            "Active",
            "Total",
            "Completed",
            "In progress",
            "Pending",
            "Overdue",
            "Cancelled",
            "Completion rate %",
            "Avg progress %",
            "Critical",
            "High",
          ],
          rows: users.map((u) => [
            u.name,
            u.email,
            u.department ?? "",
            u.isActive ? "Yes" : "No",
            u.total,
            u.completed,
            u.inProgress,
            u.pending,
            u.overdue,
            u.cancelled,
            u.completionRate,
            u.avgProgress,
            u.critical,
            u.high,
          ]),
        },
      ];
    }
    case "status": {
      const { tasks, byStatus, total } = await getStatusReport(scope);
      return [
        {
          name: "By status",
          headers: ["Status", "Tasks", "Share %"],
          rows: TASK_STATUSES.map((s) => [STATUS_LABELS[s], byStatus[s], total ? Math.round((byStatus[s] / total) * 100) : 0]),
        },
        { name: "Tasks", headers: TASK_HEADERS, rows: tasks.map(taskRow) },
      ];
    }
    case "priority": {
      const { tasks, matrix } = await getPriorityReport(scope);
      return [
        {
          name: "By priority",
          headers: ["Priority", "Total", ...TASK_STATUSES.map((s) => STATUS_LABELS[s])],
          rows: matrix.map((m) => [PRIORITY_LABELS[m.priority], m.total, ...TASK_STATUSES.map((s) => m[s])]),
        },
        { name: "Tasks", headers: TASK_HEADERS, rows: tasks.map(taskRow) },
      ];
    }
  }
}

function csvCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV with a UTF-8 BOM so Excel opens it with the right encoding. */
export function sheetToCsv(sheet: Sheet): string {
  const lines = [sheet.headers.map(csvCell).join(","), ...sheet.rows.map((r) => r.map(csvCell).join(","))];
  return "﻿" + lines.join("\r\n");
}

export async function sheetsToXlsx(sheets: Sheet[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AI Research Lab";
  workbook.created = new Date();

  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name.slice(0, 31));
    ws.columns = sheet.headers.map((header, i) => ({
      header,
      key: `c${i}`,
      width: Math.min(48, Math.max(12, header.length + 4, ...sheet.rows.map((r) => String(r[i] ?? "").length + 2))),
    }));
    for (const row of sheet.rows) ws.addRow(row);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF0F6" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.headers.length } };
  }

  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data as ArrayBuffer);
}
