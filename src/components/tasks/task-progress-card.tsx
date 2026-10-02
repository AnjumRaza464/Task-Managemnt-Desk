"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { reassignTask, updateTaskCompletion, updateTaskStatus } from "@/actions/tasks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/shared/select-field";
import { STATUS_LABELS, TASK_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { TaskFormOptions } from "@/lib/queries/tasks";
import type { TaskStatus } from "@/generated/prisma/enums";

export function TaskProgressCard({
  task,
  options,
}: {
  task: { id: string; status: TaskStatus; completion: number; assigneeId: string };
  options: TaskFormOptions;
}) {
  const router = useRouter();
  const [completion, setCompletion] = useState(task.completion);
  const [prev, setPrev] = useState(task.completion);
  if (task.completion !== prev) {
    setPrev(task.completion);
    setCompletion(task.completion);
  }
  const [pending, startTransition] = useTransition();

  function changeStatus(status: string) {
    startTransition(async () => {
      const result = await updateTaskStatus({ id: task.id, status });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Status set to ${STATUS_LABELS[result.data.status]}`);
      router.refresh();
    });
  }

  function commitCompletion(value: number) {
    if (value === task.completion) return;
    startTransition(async () => {
      const result = await updateTaskCompletion({ id: task.id, completion: value });
      if (!result.ok) {
        setCompletion(task.completion);
        toast.error(result.error);
        return;
      }
      toast.success(`Progress set to ${result.data.completion}%`);
      router.refresh();
    });
  }

  function reassign(assigneeId: string) {
    if (!assigneeId || assigneeId === task.assigneeId) return;
    startTransition(async () => {
      const result = await reassignTask({ id: task.id, assigneeId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Task reassigned");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Progress {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="task-status">Status</Label>
          <SelectField
            id="task-status"
            value={task.status}
            onChange={changeStatus}
            disabled={pending}
            options={TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="task-completion">Completion</Label>
            <span className="text-xs tabular-nums text-muted-foreground">{completion}%</span>
          </div>
          <input
            id="task-completion"
            type="range"
            min={0}
            max={100}
            step={5}
            value={completion}
            disabled={pending}
            onChange={(e) => setCompletion(Number(e.target.value))}
            onMouseUp={() => commitCompletion(completion)}
            onTouchEnd={() => commitCompletion(completion)}
            onKeyUp={(e) => {
              if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(e.key)) {
                commitCompletion(completion);
              }
            }}
            className="w-full accent-primary"
          />
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", task.status === "COMPLETED" ? "bg-emerald-500" : "bg-primary")}
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-assignee">Assigned to</Label>
          <SelectField
            id="task-assignee"
            value={task.assigneeId}
            onChange={reassign}
            disabled={pending}
            options={options.users.map((u) => ({ value: u.id, label: u.name }))}
          />
          <p className="text-xs text-muted-foreground">Reassigning moves the task into that user&apos;s plan for the same month.</p>
        </div>
      </CardContent>
    </Card>
  );
}
