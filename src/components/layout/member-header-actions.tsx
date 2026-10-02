"use client";

import { ChevronDown, LogOut } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { getInitials } from "@/lib/utils";
import type { CurrentUser } from "@/lib/auth-guard";

export function MemberHeaderActions({ user }: { user: CurrentUser }) {
  return (
    <div className="flex items-center gap-1">
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2 pl-1.5" />}>
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary/10 text-[11px] text-primary">{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm sm:inline">{user.name}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => logoutAction()}>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
