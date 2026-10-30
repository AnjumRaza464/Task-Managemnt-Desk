"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Flag, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createMilestone, deleteMilestone, updateMilestone } from "@/actions/milestones";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/badges";
import { cn, formatDate, toDateInputValue } from "@/lib/utils";
import type { ProjectDetail, ProjectTask } from "@/lib/queries/projects";

type Milestone = ProjectDetail["project"]["milestones"][number];
type FormValues = { id?: string; title: string; description: string; dueDate: string };

export function ProjectMilestones({
  projectId,
  milestones,
  tasks,
  canManage,
  taskHref,
}: {
  projectId: string;
  milestones: Milestone[];
  tasks: ProjectTask[];
  canManage: boolean;
  taskHref: string;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ open: boolean; values: FormValues }>({ open: false, values: { title: "", description: "", dueDate: "" } });
  const [deleting, setDeleting] = useState<Milestone | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const today = new Date();

  function save(event: React.FormEvent) {
    event.preventDefault();
    const v = dialog.values;
    startTransition(async () => {
      const result = v.id
        ? await updateMilestone({ id: v.id, title: v.title, description: v.description, dueDate: v.dueDate })
        : await createMilestone({ projectId, title: v.title, description: v.description, dueDate: v.dueDate });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(v.id ? "Milestone updated" : "Milestone added");
      setDialog((d) => ({ ...d, open: false }));
      router.refresh();
    });
  }

  function toggle(m: Milestone) {
    setBusyId(m.id);
    startTransition(async () => {
      const result = await updateMilestone({ id: m.id, completed: !m.completedAt });
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.completed ? "Milestone reached 🎉" : "Milestone reopened");
      router.refresh();
    });
  }

  const sorted = [...milestones].sort((a, b) => Number(Boolean(a.completedAt)) - Number(Boolean(b.completedAt)) || a.position - b.position);

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => { setErrors({}); setDialog({ open: true, values: { title: "", description: "", dueDate: "" } }); }}>
            <Plus /> New milestone
          </Button>
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="No milestones yet"
          description="Milestones mark the big checkpoints of a project (e.g. Recipes finalised, Launch day). Assign tasks to a milestone from the task form."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {sorted.map((m) => {
            const mTasks = tasks.filter((t) => t.milestoneId === m.id);
            const done = mTasks.filter((t) => t.status === "COMPLETED").length;
            const progress = mTasks.length ? Math.round((done / mTasks.length) * 100) : m.completedAt ? 100 : 0;
            const overdue = !m.completedAt && m.dueDate && m.dueDate < today;
            return (
              <Card key={m.id} className={cn("gap-3 py-4", m.completedAt && "opacity-80")}>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      aria-label={m.completedAt ? "Reopen milestone" : "Mark milestone reached"}
                      disabled={!canManage || busyId === m.id}
                      onClick={() => toggle(m)}
                      className="mt-0.5 shrink-0 disabled:cursor-default"
                    >
                      {busyId === m.id ? (
                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                      ) : m.completedAt ? (
                        <CheckCircle2 className="size-5 text-emerald-500" />
                      ) : (
                        <Circle className="size-5 text-muted-foreground" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={cn("font-medium", m.completedAt && "text-muted-foreground line-through")}>{m.title}</p>
                      {m.description && <p className="mt-0.5 text-xs text-muted-foreground">{m.description}</p>}
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                        {m.dueDate && (
                          <span className={cn(overdue && "font-medium text-rose-600 dark:text-rose-400")}>Due {formatDate(m.dueDate)}</span>
                        )}
                        {m.completedAt && <span>Reached {formatDate(m.completedAt)}</span>}
                        <span>
                          {done}/{mTasks.length} tasks
                        </span>
                      </p>
                    </div>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Milestone actions" />}>
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setErrors({});
                              setDialog({ open: true, values: { id: m.id, title: m.title, description: m.description ?? "", dueDate: toDateInputValue(m.dueDate) } });
                            }}
                          >
                            <Pencil /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(m)}>
                            <Trash2 /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full transition-all", m.completedAt ? "bg-emerald-500" : "bg-primary")} style={{ width: `${progress}%` }} />
                  </div>
                  {mTasks.length > 0 && (
                    <ul className="divide-y text-sm">
                      {mTasks.map((t) => (
                        <li key={t.id} className="flex items-center gap-2 py-1.5">
                          <Link href={`${taskHref}/${t.id}`} className={cn("min-w-0 flex-1 truncate hover:underline", t.status === "COMPLETED" && "text-muted-foreground line-through")}>
                            {t.title}
                          </Link>
                          <span className="text-xs text-muted-foreground">{formatDate(t.dueDate, "MMM d")}</span>
                          <StatusBadge status={t.status} className="px-1.5 py-0 text-[10px]" />
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}>
        <DialogContent>
          <form onSubmit={save} className="contents">
            <DialogHeader>
              <DialogTitle>{dialog.values.id ? "Edit milestone" : "New milestone"}</DialogTitle>
              <DialogDescription>A milestone is reached automatically once all of its tasks are completed.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ms-title">Title</Label>
                <Input
                  id="ms-title"
                  value={dialog.values.title}
                  onChange={(e) => setDialog((d) => ({ ...d, values: { ...d.values, title: e.target.value } }))}
                  required
                  autoFocus
                  maxLength={120}
                />
                {errors.title?.[0] && <p className="text-xs text-destructive">{errors.title[0]}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ms-description">Description</Label>
                <Textarea
                  id="ms-description"
                  rows={2}
                  maxLength={2000}
                  value={dialog.values.description}
                  onChange={(e) => setDialog((d) => ({ ...d, values: { ...d.values, description: e.target.value } }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ms-due">Due date</Label>
                <Input
                  id="ms-due"
                  type="date"
                  value={dialog.values.dueDate}
                  onChange={(e) => setDialog((d) => ({ ...d, values: { ...d.values, dueDate: e.target.value } }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setDialog((d) => ({ ...d, open: false }))}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {dialog.values.id ? "Save" : "Add milestone"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this milestone?"
        description={`Tasks linked to "${deleting?.title}" are kept; they just lose the milestone.`}
        confirmLabel="Delete milestone"
        onConfirm={async () => {
          if (!deleting) return;
          const result = await deleteMilestone(deleting.id);
          if (!result.ok) throw new Error(result.error);
          toast.success("Milestone deleted");
          router.refresh();
        }}
      />
    </div>
  );
}
