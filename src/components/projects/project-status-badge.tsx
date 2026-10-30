import { Badge } from "@/components/ui/badge";
import { PROJECT_ROLE_LABELS, PROJECT_STATUS_LABELS, PROJECT_STATUS_STYLES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ProjectRole, ProjectStatus } from "@/generated/prisma/enums";

export function ProjectStatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", PROJECT_STATUS_STYLES[status], className)}>
      {PROJECT_STATUS_LABELS[status]}
    </Badge>
  );
}

const ROLE_STYLES: Record<ProjectRole, string> = {
  OWNER: "bg-primary/10 text-primary border-primary/20",
  MANAGER: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  MEMBER: "bg-muted text-muted-foreground",
  VIEWER: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-500/15 dark:text-zinc-400 dark:border-zinc-500/30",
};

export function ProjectRoleBadge({ role, className }: { role: ProjectRole; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", ROLE_STYLES[role], className)}>
      {PROJECT_ROLE_LABELS[role]}
    </Badge>
  );
}
