"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { updateProfile } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleBadge } from "@/components/shared/badges";
import type { CurrentManager } from "@/lib/auth-guard";

export function ProfileForm({ user }: { user: CurrentManager }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const dirty = name !== user.name || email !== user.email;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = await updateProfile({ name, email });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success("Profile updated");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Profile <RoleBadge role={user.role} />
        </CardTitle>
        <CardDescription>Your name is shown in activity logs and comments.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="max-w-md space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Full name</Label>
            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
            {errors.name?.[0] && <p className="text-xs text-destructive">{errors.name[0]}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {errors.email?.[0] && <p className="text-xs text-destructive">{errors.email[0]}</p>}
            <p className="text-xs text-muted-foreground">You sign in with this email.</p>
          </div>
          <Button type="submit" disabled={!dirty || pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />} Save changes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
