"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, MoreHorizontal, Pencil, Plus, Trash2, UserCheck, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { deleteUser, setUserActive } from "@/actions/users";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActiveBadge, RoleBadge } from "@/components/shared/badges";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { UserFormDialog, type UserFormValues } from "@/components/users/user-form-dialog";
import { getInitials, percent } from "@/lib/utils";
import type { UserRow } from "@/lib/queries/users";

export function UsersTable({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<UserFormValues | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [, startTransition] = useTransition();

  function toggleActive(user: UserRow) {
    startTransition(async () => {
      const result = await setUserActive(user.id, !user.isActive);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(user.isActive ? "User deactivated" : "User activated");
      router.refresh();
    });
  }

  const toForm = (u: UserRow): UserFormValues => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    designation: u.designation ?? "",
    department: u.department ?? "",
    phone: u.phone ?? "",
    isActive: u.isActive,
    hasPassword: u.hasPassword,
  });

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus /> Add user
        </Button>
      </div>

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No users found"
          description="Add your first team member to start planning monthly tasks."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus /> Add user
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="hidden md:table-cell">Role</TableHead>
                <TableHead className="hidden lg:table-cell">Department</TableHead>
                <TableHead className="hidden sm:table-cell">Tasks</TableHead>
                <TableHead className="hidden sm:table-cell">Completion</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className={!user.isActive ? "opacity-60" : undefined}>
                  <TableCell>
                    <Link href={`/users/${user.id}`} className="flex items-center gap-3 hover:underline">
                      <Avatar className="size-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <RoleBadge role={user.role} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {user.department ?? "—"}
                    {user.designation && <span className="block text-xs">{user.designation}</span>}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell tabular-nums">
                    {user.completedTasks}/{user.totalTasks}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${percent(user.completedTasks, user.totalTasks)}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {percent(user.completedTasks, user.totalTasks)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ActiveBadge isActive={user.isActive} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" aria-label="Actions" />}
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem render={<Link href={`/users/${user.id}`} />}>
                          <Eye /> View details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditing(toForm(user))}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(user)} disabled={user.id === currentUserId}>
                          {user.isActive ? (
                            <>
                              <UserX /> Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck /> Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleting(user)}
                          disabled={user.id === currentUserId}
                        >
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <UserFormDialog open={creating} onOpenChange={setCreating} />
      <UserFormDialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} user={editing} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description={
          deleting && deleting.totalTasks > 0
            ? `This will permanently delete the user and their ${deleting.totalTasks} assigned task(s), including subtasks, comments and attachments.`
            : "This will permanently delete the user. This action cannot be undone."
        }
        confirmLabel="Delete user"
        onConfirm={async () => {
          if (!deleting) return;
          const result = await deleteUser(deleting.id);
          if (!result.ok) throw new Error(result.error);
          toast.success("User deleted");
          router.refresh();
        }}
      />
    </>
  );
}
