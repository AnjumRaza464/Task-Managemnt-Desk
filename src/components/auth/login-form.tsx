"use client";

import { useActionState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <div className="space-y-2">
        <Label htmlFor="email">Email or username</Label>
        <Input
          id="email"
          name="email"
          type="text"
          autoComplete="username"
          placeholder="you@company.com"
          required
          className="h-11 rounded-xl border-white/15 bg-white/5 px-3.5 focus-visible:border-primary/60"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          className="h-11 rounded-xl border-white/15 bg-white/5 px-3.5 focus-visible:border-primary/60"
        />
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

      <Button type="submit" size="lg" className="h-11 w-full rounded-xl text-base shadow-[0_10px_30px_-10px_rgba(240,43,155,0.8)]" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}
