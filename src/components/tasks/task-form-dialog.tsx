"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createTask, updateTask } from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/shared/select-field";
import { UserMultiSelect } from "@/components/shared/user-multi-select";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  RECURRENCES,
  RECURRENCE_LABELS,
  STATUS_LABELS,
  TASK_STATUSES,
} from "@/lib/constants";
import { toDateInputValue } from "@/lib/utils";
import type { TaskFormOptions } from "@/lib/queries/tasks";
import type { Priority, Recurrence, TaskStatus } from "@/generated/prisma/enums";

export type TaskFormValues = {
  id?: string;
  title: string;
  description: string;
  assigneeIds: string[];
  categoryId: string;
  projectId: string;
  listId: string;
  milestoneId: string;
  priority: Priority;
  status: TaskStatus;
  completion: number;
  startDate: string;
  dueDate: string;
  recurrence: Recurrence;
  recurrenceEndsAt: string;
};

export function emptyTaskValues(defaults: Partial<TaskFormValues> = {}): TaskFormValues {
  return {
    title: "",
    description: "",
    assigneeIds: [],
    categoryId: "",
    projectId: "",
    listId: "",
    milestoneId: "",
    priority: "MEDIUM",
    status: "PENDING",
    completion: 0,
    startDate: "",
    dueDate: toDateInputValue(new Date()),
    recurrence: "NONE",
    recurrenceEndsAt: "",
    ...defaults,
  };
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  options,
  defaults,
  onSaved,
  lockProject = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskFormValues | null;
  options: TaskFormOptions;
  defaults?: Partial<TaskFormValues>;
  onSaved?: (id: string) => void;
  /** Hide the project picker (the dialog was opened from inside a project). */
  lockProject?: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<TaskFormValues>(task ?? emptyTaskValues(defaults));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(task?.id);

  // Reset the form whenever the dialog opens or the task being edited changes.
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevTask, setPrevTask] = useState(task);
  if (open !== prevOpen || task !== prevTask) {
    setPrevOpen(open);
    setPrevTask(task);
    if (open) {
      setValues(task ?? emptyTaskValues(defaults));
      setErrors({});
    }
  }

  const set = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const err = (key: string) => errors[key]?.[0];
  const repeats = values.recurrence !== "NONE";
  const project = options.projects.find((p) => p.id === values.projectId) ?? null;
  // Members may only assign people who are on the project.
  const assignable = project && !options.canCreateOutsideProject ? options.users.filter((u) => project.memberIds.includes(u.id)) : options.users;
  const projectOptions = options.projects.map((p) => ({
    value: p.id,
    textLabel: `${p.workspace.name} / ${p.name}`,
    label: (
      <span className="flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
        <span className="truncate">
          {p.name} <span className="text-muted-foreground">· {p.workspace.name}</span>
        </span>
      </span>
    ),
  }));

  function changeProject(projectId: string) {
    const next = options.projects.find((p) => p.id === projectId);
    setValues((v) => ({
      ...v,
      projectId,
      listId: next?.lists.some((l) => l.id === v.listId) ? v.listId : (next?.lists[0]?.id ?? ""),
      milestoneId: next?.milestones.some((m) => m.id === v.milestoneId) ? v.milestoneId : "",
      assigneeIds: next && !options.canCreateOutsideProject ? v.assigneeIds.filter((id) => next.memberIds.includes(id)) : v.assigneeIds,
    }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = isEdit && task?.id ? await updateTask(task.id, values) : await createTask(values);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Task updated" : "Task created");
      onOpenChange(false);
      onSaved?.(result.data.id);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit task" : "New task"}</DialogTitle>
            <DialogDescription>
              {project
                ? `The task goes into ${project.name} and into the primary assignee's monthly plan.`
                : "The task is placed in the primary assignee's monthly plan based on its due date."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={values.title} onChange={(e) => set("title", e.target.value)} required autoFocus />
              {err("title") && <p className="text-xs text-destructive">{err("title")}</p>}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                placeholder="What needs to be done?"
              />
            </div>
            {!lockProject && (options.projects.length > 0 || !options.canCreateOutsideProject) && (
              <div className="space-y-1.5">
                <Label htmlFor="project">Project</Label>
                <SelectField
                  id="project"
                  value={values.projectId}
                  onChange={changeProject}
                  placeholder={options.canCreateOutsideProject ? "No project" : "Select a project"}
                  options={options.canCreateOutsideProject ? [{ value: "", label: "No project" }, ...projectOptions].filter((o) => o.value) : projectOptions}
                />
                {err("projectId") && <p className="text-xs text-destructive">{err("projectId")}</p>}
              </div>
            )}
            {project && (
              <div className="space-y-1.5">
                <Label htmlFor="list">List</Label>
                <SelectField
                  id="list"
                  value={values.listId}
                  onChange={(v) => set("listId", v)}
                  placeholder="Unsorted"
                  options={project.lists.map((l) => ({ value: l.id, label: l.name }))}
                />
              </div>
            )}
            {project && project.milestones.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="milestone">Milestone</Label>
                <SelectField
                  id="milestone"
                  value={values.milestoneId}
                  onChange={(v) => set("milestoneId", v)}
                  placeholder="No milestone"
                  options={project.milestones.map((m) => ({ value: m.id, label: m.title }))}
                />
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="assignees">Assign to</Label>
              <UserMultiSelect
                id="assignees"
                value={values.assigneeIds}
                onChange={(ids) => set("assigneeIds", ids)}
                users={assignable}
                placeholder={project && !options.canCreateOutsideProject ? "Select project members" : "Select one or more people"}
              />
              {err("assigneeIds") && <p className="text-xs text-destructive">{err("assigneeIds")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <SelectField
                id="category"
                value={values.categoryId}
                onChange={(v) => set("categoryId", v)}
                placeholder="No category"
                options={options.categories.map((c) => ({
                  value: c.id,
                  textLabel: c.name,
                  label: (
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </span>
                  ),
                }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority</Label>
              <SelectField
                id="priority"
                value={values.priority}
                onChange={(v) => set("priority", v as Priority)}
                options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <SelectField
                id="status"
                value={values.status}
                onChange={(v) => set("status", v as TaskStatus)}
                options={TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" type="date" value={values.startDate} onChange={(e) => set("startDate", e.target.value)} />
              {err("startDate") && <p className="text-xs text-destructive">{err("startDate")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" type="date" value={values.dueDate} onChange={(e) => set("dueDate", e.target.value)} required />
              {err("dueDate") && <p className="text-xs text-destructive">{err("dueDate")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recurrence">Repeat</Label>
              <SelectField
                id="recurrence"
                value={values.recurrence}
                onChange={(v) => set("recurrence", v as Recurrence)}
                options={RECURRENCES.map((r) => ({ value: r, label: RECURRENCE_LABELS[r] }))}
              />
              {repeats && (
                <p className="text-xs text-muted-foreground">The next occurrence is created when this one is completed.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recurrenceEndsAt">Repeat until</Label>
              <Input
                id="recurrenceEndsAt"
                type="date"
                value={values.recurrenceEndsAt}
                onChange={(e) => set("recurrenceEndsAt", e.target.value)}
                disabled={!repeats}
                min={values.dueDate || undefined}
              />
              {err("recurrenceEndsAt") ? (
                <p className="text-xs text-destructive">{err("recurrenceEndsAt")}</p>
              ) : (
                repeats && <p className="text-xs text-muted-foreground">Leave empty to repeat indefinitely.</p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="completion">Completion</Label>
                <span className="text-xs tabular-nums text-muted-foreground">{values.completion}%</span>
              </div>
              <input
                id="completion"
                type="range"
                min={0}
                max={100}
                step={5}
                value={values.completion}
                onChange={(e) => set("completion", Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {isEdit ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function taskToFormValues(task: {
  id: string;
  title: string;
  description: string | null;
  assigneeId: string;
  assignees?: { userId: string }[];
  categoryId: string | null;
  projectId?: string | null;
  listId?: string | null;
  milestoneId?: string | null;
  priority: Priority;
  status: TaskStatus;
  completion: number;
  startDate: Date | string | null;
  dueDate: Date | string;
  recurrence?: Recurrence;
  recurrenceEndsAt?: Date | string | null;
}): TaskFormValues {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    assigneeIds: task.assignees?.length ? task.assignees.map((a) => a.userId) : [task.assigneeId],
    categoryId: task.categoryId ?? "",
    projectId: task.projectId ?? "",
    listId: task.listId ?? "",
    milestoneId: task.milestoneId ?? "",
    priority: task.priority,
    status: task.status,
    completion: task.completion,
    startDate: toDateInputValue(task.startDate),
    dueDate: toDateInputValue(task.dueDate),
    recurrence: task.recurrence ?? "NONE",
    recurrenceEndsAt: toDateInputValue(task.recurrenceEndsAt ?? null),
  };
}
