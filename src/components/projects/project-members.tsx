"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { addProjectMember, removeProjectMember } from "@/actions/projects";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ActiveBadge, RoleBadge } from "@/components/shared/badges";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SelectField } from "@/components/shared/select-field";
import { ProjectRoleBadge } from "@/components/projects/project-status-badge";
import { PROJECT_ROLE_HINTS, PROJECT_ROLE_LABELS, PROJECT_ROLES } from "@/lib/constants";
import { getInitials } from "@/lib/utils";
import type { ProjectDetail } from "@/lib/queries/projects";
import type { ProjectRole } from "@/generated/prisma/enums";

type Member = ProjectDetail["project"]["members"][number];

export function ProjectMembers({
  projectId,
  members,
  users,
  canManage,
  isOwner,
  currentUserId,
}: {
  projectId: string;
  members: Member[];
  users: { id: string; name: string; email?: string | null }[];
  canManage: boolean;
  isOwner: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<ProjectRole>("MEMBER");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [adding, startAdd] = useTransition();
  const [, startTransition] = useTransition();
  const memberIds = new Set(members.map((m) => m.userId));
  const available = users.filter((u) => !memberIds.has(u.id));
  const roles = PROJECT_ROLES.filter((r) => r !== "OWNER" || isOwner);

  function add(event: React.FormEvent) {
    event.preventDefault();
    if (!userId) return;
    startAdd(async () => {
      const result = await addProjectMember({ projectId, userId, role });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setUserId("");
      toast.success("Member added");
      router.refresh();
    });
  }

  function changeRole(member: Member, next: string) {
    if (next === member.role) return;
    setBusyId(member.userId);
    startTransition(async () => {
      const result = await addProjectMember({ projectId, userId: member.userId, role: next });
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${member.user.name} is now ${PROJECT_ROLE_LABELS[next as ProjectRole].toLowerCase()}`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <Card>
        <CardHeader>
          <CardTitle>
            Members <span className="text-sm font-normal text-muted-foreground">{members.length}</span>
          </CardTitle>
          <CardDescription>Who is on this project and what they can do here. Global admins and managers see every project.</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <ul className="divide-y">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center gap-3 py-2.5">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary/10 text-xs text-primary">{getInitials(m.user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {m.user.name}
                      {m.userId === currentUserId && <span className="ml-1.5 rounded bg-muted px-1 text-[10px] font-normal">you</span>}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="truncate">{m.user.designation ?? m.user.email}</span>
                      <RoleBadge role={m.user.role} />
                      {!m.user.isActive && <ActiveBadge isActive={false} />}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex items-center gap-1">
                      {busyId === m.userId && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                      <SelectField
                        value={m.role}
                        onChange={(v) => changeRole(m, v)}
                        size="sm"
                        className="w-40"
                        disabled={busyId === m.userId || (m.role === "OWNER" && !isOwner)}
                        options={(m.role === "OWNER" ? PROJECT_ROLES : roles).map((r) => ({ value: r, label: PROJECT_ROLE_LABELS[r] }))}
                      />
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Remove ${m.user.name}`}
                        className="text-muted-foreground hover:text-destructive"
                        disabled={busyId === m.userId}
                        onClick={() => setRemoving(m)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ) : (
                    <ProjectRoleBadge role={m.role} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Add member</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={add} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="add-member-user">Person</Label>
                  <SelectField
                    id="add-member-user"
                    value={userId}
                    onChange={setUserId}
                    placeholder={available.length ? "Select a person" : "Everyone is already a member"}
                    disabled={available.length === 0}
                    options={available.map((u) => ({ value: u.id, label: u.name }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="add-member-role">Role</Label>
                  <SelectField
                    id="add-member-role"
                    value={role}
                    onChange={(v) => setRole(v as ProjectRole)}
                    options={roles.map((r) => ({ value: r, label: PROJECT_ROLE_LABELS[r] }))}
                  />
                  <p className="text-xs text-muted-foreground">{PROJECT_ROLE_HINTS[role]}</p>
                </div>
                <Button type="submit" size="sm" disabled={adding || !userId}>
                  {adding ? <Loader2 className="animate-spin" /> : <UserPlus />} Add to project
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {PROJECT_ROLES.map((r) => (
              <div key={r}>
                <ProjectRoleBadge role={r} />
                <p className="mt-0.5 text-xs text-muted-foreground">{PROJECT_ROLE_HINTS[r]}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.user.name} from this project?`}
        description="Tasks assigned to them in this project stay assigned; they just lose access to the project page."
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!removing) return;
          const result = await removeProjectMember({ projectId, userId: removing.userId });
          if (!result.ok) throw new Error(result.error);
          toast.success("Member removed");
          router.refresh();
        }}
      />
    </div>
  );
}
