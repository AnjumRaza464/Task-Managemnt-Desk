"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createSubtask, deleteSubtask, updateSubtask } from "@/actions/subtasks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Subtask = { id: string; title: string; isCompleted: boolean };

export function SubtaskList({ taskId, subtasks }: { taskId: string; subtasks: Subtask[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, startAdd] = useTransition();
  const [, startTransition] = useTransition();

  const done = subtasks.filter((s) => s.isCompleted).length;

  function add(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    startAdd(async () => {
      const result = await createSubtask({ taskId, title });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTitle("");
      router.refresh();
    });
  }

  function toggle(subtask: Subtask, isCompleted: boolean) {
    setBusyId(subtask.id);
    startTransition(async () => {
      const result = await updateSubtask({ id: subtask.id, isCompleted });
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function rename(subtask: Subtask) {
    const next = editTitle.trim();
    if (!next || next === subtask.title) {
      setEditingId(null);
      return;
    }
    setBusyId(subtask.id);
    startTransition(async () => {
      const result = await updateSubtask({ id: subtask.id, title: next });
      setBusyId(null);
      setEditingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function remove(subtask: Subtask) {
    setBusyId(subtask.id);
    startTransition(async () => {
      const result = await deleteSubtask(subtask.id);
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Subtask removed");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Subtasks{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {done}/{subtasks.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {subtasks.length > 0 && (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${subtasks.length ? Math.round((done / subtasks.length) * 100) : 0}%` }}
            />
          </div>
        )}

        <ul className="divide-y">
          {subtasks.map((s) => {
            const busy = busyId === s.id;
            const editing = editingId === s.id;
            return (
              <li key={s.id} className="group flex items-center gap-3 py-2">
                {busy ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <Checkbox
                    checked={s.isCompleted}
                    onCheckedChange={(checked) => toggle(s, Boolean(checked))}
                    aria-label={`Mark "${s.title}" ${s.isCompleted ? "incomplete" : "complete"}`}
                  />
                )}
                {editing ? (
                  <form
                    className="flex flex-1 items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      rename(s);
                    }}
                  >
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      autoFocus
                      className="h-8"
                      onKeyDown={(e) => e.key === "Escape" && setEditingId(null)}
                    />
                    <Button type="submit" size="icon-sm" variant="ghost" aria-label="Save">
                      <Check />
                    </Button>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel" onClick={() => setEditingId(null)}>
                      <X />
                    </Button>
                  </form>
                ) : (
                  <>
                    <span className={cn("flex-1 text-sm", s.isCompleted && "text-muted-foreground line-through")}>{s.title}</span>
                    <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Rename subtask"
                        onClick={() => {
                          setEditingId(s.id);
                          setEditTitle(s.title);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Delete subtask"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => remove(s)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>

        <form onSubmit={add} className="flex items-center gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a subtask and press Enter"
            maxLength={160}
            aria-label="New subtask"
          />
          <Button type="submit" size="sm" variant="outline" disabled={adding || !title.trim()}>
            {adding ? <Loader2 className="animate-spin" /> : <Plus />} Add
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
