"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateMyTaskCompletion, updateMyTaskStatus } from "@/actions/member";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/shared/select-field";
import { STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/generated/prisma/enums";

const MEMBER_STATUSES: TaskStatus[] = ["PENDING", "IN_PROGRESS", "COMPLETED"];

export function MyTaskControls({ task }: { task: { id: string; status: TaskStatus; completion: number } }) {
  const router = useRouter();
  const [completion, setCompletion] = useState(task.completion);
  const [prev, setPrev] = useState(task.completion);
  if (task.completion !== prev) {
    setPrev(task.completion);
    setCompletion(task.completion);
  }
  const [pending, startTransition] = useTransition();
  const locked = task.status === "CANCELLED";

  // Overdue tasks show their real status; picking Pending/In progress keeps them overdue until the due date moves.
  const options = [
    ...MEMBER_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
    ...(MEMBER_STATUSES.includes(task.status) ? [] : [{ value: task.status, label: STATUS_LABELS[task.status] }]),
  ];

  function changeStatus(status: string) {
    if (status === task.status) return;
    startTransition(async () => {
      const result = await updateMyTaskStatus({ id: task.id, status });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const label = STATUS_LABELS[result.data.status];
      if (result.data.status !== status && result.data.status === "OVERDUE") {
        toast.info(`Saved. The task stays Overdue because its due date has passed.`);
      } else {
        toast.success(`Status set to ${label}`);
      }
      router.refresh();
    });
  }

  function commitCompletion(value: number) {
    if (value === task.completion) return;
    startTransition(async () => {
      const result = await updateMyTaskCompletion({ id: task.id, completion: value });
      if (!result.ok) {
        setCompletion(task.completion);
        toast.error(result.error);
        return;
      }
      toast.success(result.data.status === "COMPLETED" ? "Task completed" : `Progress set to ${result.data.completion}%`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="my-status">Status</Label>
          {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        </div>
        <SelectField id="my-status" value={task.status} onChange={changeStatus} disabled={pending || locked} options={options} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="my-completion">Progress</Label>
          <span className="text-xs tabular-nums text-muted-foreground">{completion}%</span>
        </div>
        <input
          id="my-completion"
          type="range"
          min={0}
          max={100}
          step={5}
          value={completion}
          disabled={pending || locked}
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
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", task.status === "COMPLETED" ? "bg-emerald-500" : "bg-primary")}
            style={{ width: `${completion}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {locked ? "This task was cancelled by a manager." : "Setting 100% marks the task completed; your manager is notified."}
        </p>
      </div>
    </div>
  );
}
