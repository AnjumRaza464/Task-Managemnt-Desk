"use client";

import { useState, useTransition } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { changePassword } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordForm() {
  const [values, setValues] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof values, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const err = (key: string) => errors[key]?.[0];

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = await changePassword(values);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success("Password changed");
      setValues({ currentPassword: "", newPassword: "", confirmPassword: "" });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Use at least 8 characters. You will stay signed in on this device.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="max-w-md space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pw-current">Current password</Label>
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={values.currentPassword}
              onChange={(e) => set("currentPassword", e.target.value)}
              required
            />
            {err("currentPassword") && <p className="text-xs text-destructive">{err("currentPassword")}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-new">New password</Label>
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              value={values.newPassword}
              onChange={(e) => set("newPassword", e.target.value)}
              required
              minLength={8}
            />
            {err("newPassword") && <p className="text-xs text-destructive">{err("newPassword")}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-confirm">Confirm new password</Label>
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              value={values.confirmPassword}
              onChange={(e) => set("confirmPassword", e.target.value)}
              required
            />
            {err("confirmPassword") && <p className="text-xs text-destructive">{err("confirmPassword")}</p>}
          </div>
          <Button type="submit" disabled={pending || !values.currentPassword || !values.newPassword}>
            {pending ? <Loader2 className="animate-spin" /> : <KeyRound />} Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
