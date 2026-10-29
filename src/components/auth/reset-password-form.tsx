"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { resetPassword } from "@/actions/password-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPassword, undefined);
  const err = (key: string) => state?.fieldErrors?.[key]?.[0];

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          minLength={8}
          required
          autoFocus
        />
        {err("password") && <p className="text-xs text-destructive">{err("password")}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
        {err("confirmPassword") && <p className="text-xs text-destructive">{err("confirmPassword")}</p>}
      </div>

      {state?.error && !state.fieldErrors && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            {state.error}{" "}
            <Link href="/forgot-password" className="underline">
              Request a new link
            </Link>
          </span>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Set new password
      </Button>
    </form>
  );
}
