"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createProject, updateProject } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/shared/select-field";
import { UserMultiSelect, type UserOption } from "@/components/shared/user-multi-select";
import { ColorPicker } from "@/components/projects/color-picker";
import { PROJECT_STATUS_LABELS, PROJECT_STATUSES } from "@/lib/constants";
import type { ProjectStatus } from "@/generated/prisma/enums";

export type ProjectFormValues = {
  id?: string;
  workspaceId: string;
  name: string;
  description: string;
  color: string;
  status: ProjectStatus;
  startDate: string;
  dueDate: string;
  memberIds: string[];
};

export type WorkspaceOption = { id: string; name: string; color: string };

export function emptyProjectValues(defaults: Partial<ProjectFormValues> = {}): ProjectFormValues {
  return {
    workspaceId: "",
    name: "",
    description: "",
    color: "#6366f1",
    status: "ACTIVE",
    startDate: "",
    dueDate: "",
    memberIds: [],
    ...defaults,
  };
}

export function ProjectDialog({
  open,
  onOpenChange,
  project,
  defaults,
  workspaces,
  users,
  canChangeWorkspace = true,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: ProjectFormValues | null;
  defaults?: Partial<ProjectFormValues>;
  workspaces: WorkspaceOption[];
  users: UserOption[];
  canChangeWorkspace?: boolean;
  onSaved?: (id: string) => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProjectFormValues>(project ?? emptyProjectValues(defaults));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(project?.id);

  const [prevOpen, setPrevOpen] = useState(open);
  const [prevProject, setPrevProject] = useState(project);
  if (open !== prevOpen || project !== prevProject) {
    setPrevOpen(open);
    setPrevProject(project);
    if (open) {
      setValues(project ?? emptyProjectValues(defaults));
      setErrors({});
    }
  }

  const set = <K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  const err = (key: string) => errors[key]?.[0];

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = isEdit && project?.id ? await updateProject(project.id, values) : await createProject(values);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Project updated" : "Project created");
      onOpenChange(false);
      onSaved?.(result.data.id);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit project" : "New project"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Change the project details and who is on it." : "A project gets three lists (To do, In progress, Done) to start with."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="project-name">Name</Label>
              <Input id="project-name" value={values.name} onChange={(e) => set("name", e.target.value)} required autoFocus maxLength={80} />
              {err("name") && <p className="text-xs text-destructive">{err("name")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-workspace">Workspace</Label>
              <SelectField
                id="project-workspace"
                value={values.workspaceId}
                onChange={(v) => set("workspaceId", v)}
                placeholder="Select workspace"
                disabled={!canChangeWorkspace}
                options={workspaces.map((w) => ({
                  value: w.id,
                  textLabel: w.name,
                  label: (
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: w.color }} />
                      {w.name}
                    </span>
                  ),
                }))}
              />
              {err("workspaceId") && <p className="text-xs text-destructive">{err("workspaceId")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-status">Status</Label>
              <SelectField
                id="project-status"
                value={values.status}
                onChange={(v) => set("status", v as ProjectStatus)}
                options={PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s] }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Goal, scope and anything the team should know"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-start">Start date</Label>
              <Input id="project-start" type="date" value={values.startDate} onChange={(e) => set("startDate", e.target.value)} />
              {err("startDate") && <p className="text-xs text-destructive">{err("startDate")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-due">Due date</Label>
              <Input id="project-due" type="date" value={values.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="project-members">Members</Label>
              <UserMultiSelect
                id="project-members"
                value={values.memberIds}
                onChange={(ids) => set("memberIds", ids)}
                users={users}
                placeholder="Add team members"
                primaryHint={false}
              />
              <p className="text-xs text-muted-foreground">
                {isEdit ? "People picked here are added as members; manage roles on the Members tab." : "You become the owner; everyone else joins as a member."}
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Color</Label>
              <ColorPicker value={values.color} onChange={(c) => set("color", c)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {isEdit ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
