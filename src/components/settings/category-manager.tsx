"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createCategory, deleteCategory, updateCategory } from "@/actions/categories";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import type { CategoryRow } from "@/lib/queries/categories";

const PRESET_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#0ea5e9", "#8b5cf6", "#14b8a6", "#f43f5e", "#64748b"];

function ColorInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        id={id}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Category color"
        className="size-8 cursor-pointer rounded-md border bg-transparent p-0.5"
      />
      <div className="hidden items-center gap-1 sm:flex">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Use color ${c}`}
            onClick={() => onChange(c)}
            className="size-4 rounded-full ring-offset-background transition-transform hover:scale-110 data-[active=true]:ring-2 data-[active=true]:ring-ring data-[active=true]:ring-offset-2"
            data-active={value.toLowerCase() === c}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editing, setEditing] = useState<{ id: string; name: string; color: string } | null>(null);
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, startCreate] = useTransition();
  const [, startTransition] = useTransition();

  function create(event: React.FormEvent) {
    event.preventDefault();
    startCreate(async () => {
      const result = await createCategory({ name: newName, color: newColor });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setNewName("");
      toast.success("Category added");
      router.refresh();
    });
  }

  function save() {
    if (!editing) return;
    const { id, name, color } = editing;
    setBusyId(id);
    startTransition(async () => {
      const result = await updateCategory(id, { name, color });
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEditing(null);
      toast.success("Category updated");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categories</CardTitle>
        <CardDescription>Group tasks by area of work. Deleting a category leaves its tasks uncategorized.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={create} className="flex flex-wrap items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name"
            maxLength={40}
            className="w-full sm:w-56"
            aria-label="New category name"
          />
          <ColorInput value={newColor} onChange={setNewColor} />
          <Button type="submit" size="sm" disabled={creating || newName.trim().length < 2}>
            {creating ? <Loader2 className="animate-spin" /> : <Plus />} Add
          </Button>
        </form>

        {categories.length === 0 ? (
          <EmptyState icon={Tags} title="No categories yet" className="py-8" />
        ) : (
          <ul className="divide-y rounded-lg border">
            {categories.map((c) => {
              const isEditing = editing?.id === c.id;
              const busy = busyId === c.id;
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  {isEditing ? (
                    <>
                      <ColorInput value={editing.color} onChange={(color) => setEditing({ ...editing, color })} />
                      <Input
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        className="h-8 w-48"
                        maxLength={40}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") save();
                          if (e.key === "Escape") setEditing(null);
                        }}
                      />
                      <div className="ml-auto flex items-center gap-1">
                        <Button size="sm" onClick={save} disabled={busy}>
                          {busy ? <Loader2 className="animate-spin" /> : <Check />} Save
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label="Cancel" onClick={() => setEditing(null)}>
                          <X />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="text-sm font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.taskCount} task{c.taskCount === 1 ? "" : "s"}
                      </span>
                      <div className="ml-auto flex items-center">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Edit ${c.name}`}
                          onClick={() => setEditing({ id: c.id, name: c.name, color: c.color })}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Delete ${c.name}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleting(c)}
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
        )}
      </CardContent>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description={
          deleting && deleting.taskCount > 0
            ? `${deleting.taskCount} task${deleting.taskCount === 1 ? "" : "s"} will become uncategorized. The tasks themselves are not deleted.`
            : "This category is not used by any task."
        }
        confirmLabel="Delete category"
        onConfirm={async () => {
          if (!deleting) return;
          const result = await deleteCategory(deleting.id);
          if (!result.ok) throw new Error(result.error);
          toast.success("Category deleted");
          router.refresh();
        }}
      />
    </Card>
  );
}
