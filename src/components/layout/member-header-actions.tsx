"use client";

import { useState, useTransition } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { toast } from "sonner";
import { logoutAction } from "@/actions/auth";
import { updateEmailPreference } from "@/actions/settings";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ActivityTracker } from "@/components/attendance/activity-tracker";
import { getInitials } from "@/lib/utils";
import type { CurrentUser } from "@/lib/auth-guard";

export function MemberHeaderActions({ user, emailNotifications }: { user: CurrentUser; emailNotifications: boolean }) {
  const [emails, setEmails] = useState(emailNotifications);
  const [, startTransition] = useTransition();

  function toggleEmails(next: boolean) {
    setEmails(next);
    startTransition(async () => {
      const result = await updateEmailPreference(next);
      if (!result.ok) {
        setEmails(!next);
        toast.error(result.error);
        return;
      }
      toast.success(next ? "Email notifications on" : "Email notifications off");
    });
  }

  return (
    <div className="flex items-center gap-1">
      <ActivityTracker />
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2 pl-1.5" />}>
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary/10 text-[11px] text-primary">{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm sm:inline">{user.name}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {/* GroupLabel must live inside a Group (Base UI error #31 otherwise). */}
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={emails} onCheckedChange={(checked) => toggleEmails(checked)} closeOnClick={false}>
            Email notifications
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => logoutAction()}>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
