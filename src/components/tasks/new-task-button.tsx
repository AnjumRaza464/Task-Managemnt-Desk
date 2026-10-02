"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskFormDialog, type TaskFormValues } from "@/components/tasks/task-form-dialog";
import type { TaskFormOptions } from "@/lib/queries/tasks";

export function NewTaskButton({
  options,
  defaults,
  label = "New task",
  variant = "default",
  size = "default",
}: {
  options: TaskFormOptions;
  defaults?: Partial<TaskFormValues>;
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant={variant} size={size}>
        <Plus /> {label}
      </Button>
      <TaskFormDialog open={open} onOpenChange={setOpen} options={options} defaults={defaults} />
    </>
  );
}
