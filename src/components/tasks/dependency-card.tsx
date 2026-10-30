"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, Loader2, Lock, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { addDependency, removeDependency } from "@/actions/dependencies";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/badges";
import { SelectField } from "@/components/shared/select-field";
import { cn, formatDate } from "@/lib/utils";
import type { TaskStatus } from "@/generated/prisma/enums";

type Ref = { id: string; title: string; status: TaskStatus; dueDate: Date };
type Candidate = { id: string; title: string; status: TaskStatus };

const OPEN: TaskStatus[] = ["PENDING", "IN_PROGRESS", "OVERDUE"];

export function DependencyCard({
  taskId,
  blockedBy,
  blocks,
  candidates,
  canEdit,
  taskHref,
}: {
  taskId: string;
  blockedBy: Ref[];
  blocks: Ref[];
  candidates: Candidate[];
  canEdit: boolean;
  taskHref: string;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const taken = new Set([taskId, ...blockedBy.map((t) => t.id), ...blocks.map((t) => t.id)]);
  const options = candidates.filter((c) => !taken.has(c.id));
  const openBlockers = blockedBy.filter((t) => OPEN.includes(t.status));

  function add() {
    if (!picked) return;
    startTransition(async () => {
      const result = await addDependency({ taskId, blockerId: picked });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPicked("");
      toast.success("Dependency added");
      router.refresh();
    });
  }

  function remove(blockerId: string, blockedId: string) {
    setBusy(`${blockerId}:${blockedId}`);
    startTransition(async () => {
      const result = await removeDependency({ taskId: blockedId, blockerId });
      setBusy(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function row(t: Ref, key: string, onRemove?: () => void) {
    return (
      <li key={t.id} className="flex items-center gap-2 py-1.5 text-sm">
        <Link href={`${taskHref}/${t.id}`} className={cn("min-w-0 flex-1 truncate hover:underline", t.status === "COMPLETED" && "text-muted-foreground line-through")}>
          {t.title}
        </Link>
        <span className="hidden text-xs text-muted-foreground sm:inline">{formatDate(t.dueDate, "MMM d")}</span>
        <StatusBadge status={t.status} className="px-1.5 py-0 text-[10px]" />
        {onRemove && (
          <Button size="icon-xs" variant="ghost" aria-label="Remove dependency" disabled={busy === key} onClick={onRemove}>
            {busy === key ? <Loader2 className="animate-spin" /> : <X />}
          </Button>
        )}
      </li>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="size-4 text-muted-foreground" /> Dependencies
        </CardTitle>
        <CardDescription>
          {openBlockers.length > 0 ? (
            <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300">
              <Lock className="size-3.5" /> Blocked by {openBlockers.length} open task{openBlockers.length === 1 ? "" : "s"}
            </span>
          ) : (
            "This task can only be completed once everything it waits on is done."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Waits on</p>
          {blockedBy.length === 0 ? (
            <p className="py-1.5 text-sm text-muted-foreground">Nothing.</p>
          ) : (
            <ul className="divide-y">{blockedBy.map((t) => row(t, `${t.id}:${taskId}`, canEdit ? () => remove(t.id, taskId) : undefined))}</ul>
          )}
          {canEdit && options.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <SelectField
                value={picked}
                onChange={setPicked}
                placeholder="Add a task this one waits on…"
                size="sm"
                options={options.map((c) => ({ value: c.id, label: c.title }))}
              />
              <Button size="sm" variant="outline" disabled={!picked || pending} onClick={add}>
                {pending ? <Loader2 className="animate-spin" /> : <Plus />} Add
              </Button>
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Blocks</p>
          {blocks.length === 0 ? (
            <p className="py-1.5 text-sm text-muted-foreground">No task is waiting on this one.</p>
          ) : (
            <ul className="divide-y">{blocks.map((t) => row(t, `${taskId}:${t.id}`, canEdit ? () => remove(taskId, t.id) : undefined))}</ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
