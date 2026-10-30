"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteProject } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { UserOption } from "@/components/shared/user-multi-select";
import { ProjectDialog, type ProjectFormValues, type WorkspaceOption } from "@/components/projects/project-dialog";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import type { TaskFormOptions } from "@/lib/queries/tasks";

export function ProjectHeaderActions({
  project,
  workspaces,
  users,
  options,
  canEdit,
  canManage,
  canDelete,
  backHref,
}: {
  project: ProjectFormValues & { id: string; taskCount: number };
  workspaces: WorkspaceOption[];
  users: UserOption[];
  options: TaskFormOptions;
  canEdit: boolean;
  canManage: boolean;
  canDelete: boolean;
  backHref: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const closed = project.status === "COMPLETED" || project.status === "ARCHIVED";

  return (
    <>
      {canEdit && !closed && (
        <Button onClick={() => setCreating(true)}>
          <Plus /> New task
        </Button>
      )}
      {canManage && (
        <Button variant="outline" onClick={() => setEditing(true)}>
          <Pencil /> Edit
        </Button>
      )}
      {canDelete && (
        <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleting(true)}>
          <Trash2 /> Delete
        </Button>
      )}

      <ProjectDialog open={editing} onOpenChange={setEditing} project={project} workspaces={workspaces} users={users} canChangeWorkspace={canDelete} />
      <TaskFormDialog
        open={creating}
        onOpenChange={setCreating}
        options={options}
        defaults={{ projectId: project.id, listId: options.projects.find((p) => p.id === project.id)?.lists[0]?.id ?? "" }}
        lockProject
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this project?"
        description={`"${project.name}", its lists, milestones, members and discussion will be removed. Its ${project.taskCount} task(s) are kept in their monthly plans without a project.`}
        confirmLabel="Delete project"
        onConfirm={async () => {
          const result = await deleteProject(project.id);
          if (!result.ok) throw new Error(result.error);
          toast.success("Project deleted");
          router.push(backHref);
          router.refresh();
        }}
      />
    </>
  );
}
