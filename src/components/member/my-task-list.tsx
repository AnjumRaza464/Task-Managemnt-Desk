"use client";

import { useState } from "react";
import { CheckSquare, MessageSquare, Paperclip, Users } from "lucide-react";
import { TaskModal } from "@/components/member/task-modal";
import type { MentionUser } from "@/components/tasks/mention-composer";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryBadge, PriorityBadge, StatusBadge } from "@/components/shared/badges";
import type { TaskFormOptions, TaskListItem } from "@/lib/queries/tasks";
import { formatDate } from "@/lib/utils";

/**
 * The task cards on My tasks. Clicking one opens the same task modal as the
 * project board and list (details on the left, chat / discussion on the
 * right) instead of leaving the page.
 */
export function MyTaskList({
  tasks,
  currentUserId,
  users,
  options = null,
}: {
  tasks: TaskListItem[];
  currentUserId: string;
  users: MentionUser[];
  options?: TaskFormOptions | null;
}) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  return (
    <>
      <div className="grid gap-3">
        {tasks.map((task) => {
          const done = task.subtasks.filter((s) => s.isCompleted).length;
          const others = task.assignees.filter((a) => a.userId !== currentUserId);
          return (
            <Card
              key={task.id}
              role="button"
              tabIndex={0}
              aria-label={`Open ${task.title}`}
              className="cursor-pointer transition-colors hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              onClick={() => setOpenTaskId(task.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpenTaskId(task.id);
                }
              }}
            >
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-medium">{task.title}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>Due {formatDate(task.dueDate)}</span>
                    <CategoryBadge category={task.category} />
                    {others.length > 0 && (
                      <span className="inline-flex items-center gap-1" title={others.map((a) => a.user.name).join(", ")}>
                        <Users className="size-3" /> with {others.length === 1 ? others[0].user.name : `${others.length} others`}
                      </span>
                    )}
                    {task._count.subtasks > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <CheckSquare className="size-3" /> {done}/{task._count.subtasks}
                      </span>
                    )}
                    {task._count.comments > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="size-3" /> {task._count.comments}
                      </span>
                    )}
                    {task._count.attachments > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Paperclip className="size-3" /> {task._count.attachments}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={task.priority} />
                  <StatusBadge status={task.status} />
                  <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{task.completion}%</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <TaskModal taskId={openTaskId} onOpenChange={(o) => !o && setOpenTaskId(null)} users={users} taskHref="/my-tasks" options={options} />
    </>
  );
}
