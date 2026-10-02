"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createUser, updateUser } from "@/actions/users";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SelectField } from "@/components/shared/select-field";
import { ROLE_LABELS, ROLES } from "@/lib/constants";
import type { Role } from "@/generated/prisma/enums";

export type UserFormValues = {
  id?: string;
  name: string;
  email: string;
  role: Role;
  designation: string;
  department: string;
  phone: string;
  isActive: boolean;
  hasPassword?: boolean;
};

const EMPTY: UserFormValues = {
  name: "",
  email: "",
  role: "MEMBER",
  designation: "",
  department: "",
  phone: "",
  isActive: true,
};

export function UserFormDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserFormValues | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<UserFormValues>(user ?? EMPTY);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(user?.id);

  // Reset the form whenever the dialog opens or the user being edited changes.
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevUser, setPrevUser] = useState(user);
  if (open !== prevOpen || user !== prevUser) {
    setPrevOpen(open);
    setPrevUser(user);
    if (open) {
      setValues(user ?? EMPTY);
      setPassword("");
      setErrors({});
    }
  }

  const set = <K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const loginRole = values.role !== "MEMBER";
  const err = (key: string) => errors[key]?.[0];

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    startTransition(async () => {
      const payload = { ...values, password: password || undefined };
      const result = isEdit && user?.id ? await updateUser(user.id, payload) : await createUser(payload);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "User updated" : "User created");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit user" : "Add user"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update the user's details and access."
                : "Team members are assignees only. Admins and managers can sign in."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={values.name} onChange={(e) => set("name", e.target.value)} required />
              {err("name") && <p className="text-xs text-destructive">{err("name")}</p>}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={values.email} onChange={(e) => set("email", e.target.value)} required />
              {err("email") && <p className="text-xs text-destructive">{err("email")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <SelectField
                id="role"
                value={values.role}
                onChange={(v) => set("role", v as Role)}
                options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" value={values.designation} onChange={(e) => set("designation", e.target.value)} placeholder="e.g. Frontend Developer" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="department">Department</Label>
              <Input id="department" value={values.department} onChange={(e) => set("department", e.target.value)} placeholder="e.g. Engineering" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={values.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+92 ..." />
            </div>

            {(
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="password">
                  {isEdit && user?.hasPassword ? "New password (leave blank to keep)" : loginRole ? "Password" : "Password (optional — lets the member sign in to view their own tasks)"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                />
                {err("password") && <p className="text-xs text-destructive">{err("password")}</p>}
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Inactive users cannot be assigned tasks or sign in.</p>
              </div>
              <Switch checked={values.isActive} onCheckedChange={(v) => set("isActive", v)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {isEdit ? "Save changes" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
