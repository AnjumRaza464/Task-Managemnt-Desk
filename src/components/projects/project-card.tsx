import Link from "next/link";
import { CalendarDays, Flag, ListChecks } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { AssigneeAvatars } from "@/components/shared/assignee-avatars";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { cn, formatDate } from "@/lib/utils";
import type { ProjectCard as ProjectCardData } from "@/lib/queries/projects";

export function ProjectCard({ project, href }: { project: ProjectCardData; href: string }) {
  const s = project.stats;
  const members = project.members.map((m) => ({ user: m.user }));
  return (
    <Card className="group relative gap-3 overflow-hidden py-4 transition-colors hover:bg-accent/30">
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: project.color }} />
      <CardContent className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <Link href={href} className="min-w-0 flex-1 truncate font-medium hover:underline">
            {project.name}
          </Link>
          <ProjectStatusBadge status={project.status} />
        </div>
        {project.description && <p className="line-clamp-2 text-xs text-muted-foreground">{project.description}</p>}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {s.completed}/{s.total} tasks done
            </span>
            <span className="tabular-nums">{s.progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-all" style={{ width: `${s.progress}%`, backgroundColor: project.color }} />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <AssigneeAvatars assignees={members} size="xs" max={4} />
        <span className="flex items-center gap-3">
          {s.overdue > 0 && <span className={cn("font-medium text-rose-600 dark:text-rose-400")}>{s.overdue} overdue</span>}
          {project._count.milestones > 0 && (
            <span className="inline-flex items-center gap-1">
              <Flag className="size-3" /> {project._count.milestones}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <ListChecks className="size-3" /> {project._count.lists}
          </span>
          {project.dueDate && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3" /> {formatDate(project.dueDate, "MMM d")}
            </span>
          )}
        </span>
      </CardFooter>
    </Card>
  );
}
