"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createWorkspace, updateWorkspace } from "@/actions/workspaces";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ColorPicker } from "@/components/projects/color-picker";

export type WorkspaceFormValues = { id?: string; name: string; description: string; color: string };

export function WorkspaceDialog({
  open,
  onOpenChange,
  workspace,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace?: WorkspaceFormValues | null;
}) {
  const router = useRouter();
  const empty: WorkspaceFormValues = { name: "", description: "", color: "#6366f1" };
  const [values, setValues] = useState<WorkspaceFormValues>(workspace ?? empty);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(workspace?.id);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setValues(workspace ?? empty);
      setErrors({});
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = isEdit && workspace?.id ? await updateWorkspace(workspace.id, values) : await createWorkspace(values);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Workspace updated" : "Workspace created");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit workspace" : "New workspace"}</DialogTitle>
            <DialogDescription>A workspace groups related projects, e.g. a department, a branch or a client.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ws-name">Name</Label>
              <Input id="ws-name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} required autoFocus maxLength={60} />
              {errors.name?.[0] && <p className="text-xs text-destructive">{errors.name[0]}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ws-description">Description</Label>
              <Textarea
                id="ws-description"
                value={values.description}
                onChange={(e) => setValues({ ...values, description: e.target.value })}
                rows={2}
                maxLength={500}
                placeholder="What belongs in this workspace?"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <ColorPicker value={values.color} onChange={(color) => setValues({ ...values, color })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {isEdit ? "Save" : "Create workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
