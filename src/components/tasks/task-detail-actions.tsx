"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTask } from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TaskFormDialog, taskToFormValues } from "@/components/tasks/task-form-dialog";
import type { TaskFormOptions } from "@/lib/queries/tasks";

export function TaskDetailActions({
  task,
  options,
}: {
  task: Parameters<typeof taskToFormValues>[0];
  options: TaskFormOptions;
}) {
  const router = useRouter();
  const taskId = task.id;
  const values = taskToFormValues(task);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil /> Edit
      </Button>
      <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleting(true)}>
        <Trash2 /> Delete
      </Button>

      <TaskFormDialog open={editing} onOpenChange={setEditing} task={values} options={options} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this task?"
        description={`"${task.title}" and all of its subtasks, comments and attachments will be permanently removed.`}
        confirmLabel="Delete task"
        onConfirm={async () => {
          const result = await deleteTask(taskId);
          if (!result.ok) throw new Error(result.error);
          toast.success("Task deleted");
          router.push("/tasks");
          router.refresh();
        }}
      />
    </>
  );
}
