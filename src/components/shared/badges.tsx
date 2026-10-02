import { Badge } from "@/components/ui/badge";
import {
  PRIORITY_LABELS,
  PRIORITY_STYLES,
  ROLE_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Priority, Role, TaskStatus } from "@/generated/prisma/enums";

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_STYLES[status], className)}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", PRIORITY_STYLES[priority], className)}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const styles: Record<Role, string> = {
    ADMIN: "bg-primary/10 text-primary border-primary/20",
    MANAGER: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
    MEMBER: "bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", styles[role])}>
      {ROLE_LABELS[role]}
    </Badge>
  );
}

export function CategoryBadge({ category }: { category: { name: string; color: string } | null }) {
  if (!category) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="size-2 rounded-full" style={{ backgroundColor: category.color }} />
      {category.name}
    </span>
  );
}

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        isActive
          ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
          : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-500/15 dark:text-zinc-400 dark:border-zinc-500/30",
      )}
    >
      {isActive ? "Active" : "Inactive"}
    </Badge>
  );
}
