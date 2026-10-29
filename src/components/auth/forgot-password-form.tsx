"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { requestPasswordReset } from "@/actions/password-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, undefined);

  if (state?.sent) {
    return (
      <div className="space-y-5">
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300"
        >
          <MailCheck className="mt-0.5 size-4 shrink-0" />
          <span>
            If an account exists for that email, a reset link is on its way. It works for 1 hour. Check your spam folder
            if it does not arrive.
          </span>
        </div>
        <Button variant="outline" className="w-full" nativeButton={false} render={<Link href="/login" />}>
          <ArrowLeft /> Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required autoFocus />
      </div>

      {state?.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Send reset link
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
