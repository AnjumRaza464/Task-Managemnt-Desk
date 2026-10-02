import type { Priority, TaskStatus, Role } from "@/generated/prisma/enums";

export const APP_NAME = "AI Research Lab";
export const APP_DESCRIPTION = "Monthly task planning & management for managers";

export const TASK_STATUSES: TaskStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "OVERDUE",
  "CANCELLED",
];

export const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export const ROLES: Role[] = ["ADMIN", "MANAGER", "MEMBER"];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  MEMBER: "Team Member",
};

/** Tailwind classes for badges (light + dark). */
export const STATUS_STYLES: Record<TaskStatus, string> = {
  PENDING:
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
  IN_PROGRESS:
    "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
  COMPLETED:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  OVERDUE:
    "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
  CANCELLED:
    "bg-zinc-100 text-zinc-500 border-zinc-200 line-through dark:bg-zinc-500/15 dark:text-zinc-400 dark:border-zinc-500/30",
};

export const PRIORITY_STYLES: Record<Priority, string> = {
  LOW: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
  MEDIUM:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
  CRITICAL:
    "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
};

/** Hex colors used by charts (consistent with badge hues). */
export const STATUS_COLORS: Record<TaskStatus, string> = {
  PENDING: "#64748b",
  IN_PROGRESS: "#0284c7",
  COMPLETED: "#059669",
  OVERDUE: "#e11d48",
  CANCELLED: "#a1a1aa",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  LOW: "#64748b",
  MEDIUM: "#d97706",
  HIGH: "#ea580c",
  CRITICAL: "#dc2626",
};

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB
export const PAGE_SIZE = 20;
