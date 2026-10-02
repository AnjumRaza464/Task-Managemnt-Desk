"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePlan, updatePlan } from "@/actions/plans";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export function PlanDetailsCard({
  plan,
  taskCount,
  backHref,
}: {
  plan: { id: string; title: string | null; notes: string | null };
  taskCount: number;
  backHref: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(plan.title ?? "");
  const [notes, setNotes] = useState(plan.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty = title !== (plan.title ?? "") || notes !== (plan.notes ?? "");

  function save(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updatePlan({ id: plan.id, title, notes });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Plan saved");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan details</CardTitle>
        <CardDescription>Optional title and notes for this month.</CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete plan"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="plan-title">Title</Label>
            <Input
              id="plan-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q4 launch preparation"
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-notes">Notes</Label>
            <Textarea
              id="plan-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Goals, context or reminders for this month"
              rows={5}
              maxLength={2000}
            />
          </div>
          <Button type="submit" size="sm" disabled={!dirty || pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />} Save
          </Button>
        </form>
      </CardContent>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this monthly plan?"
        description={
          taskCount > 0
            ? `All ${taskCount} task${taskCount === 1 ? "" : "s"} in this plan, including subtasks, comments and attachments, will be permanently removed.`
            : "The plan will be removed. You can start a new one for this month at any time."
        }
        confirmLabel="Delete plan"
        onConfirm={async () => {
          const result = await deletePlan(plan.id);
          if (!result.ok) throw new Error(result.error);
          toast.success("Plan deleted");
          router.push(backHref);
          router.refresh();
        }}
      />
    </Card>
  );
}
