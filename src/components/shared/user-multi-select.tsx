"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, getInitials } from "@/lib/utils";

export type UserOption = { id: string; name: string; email?: string | null };

/**
 * Pick several users. The selection order is kept (the first user is the
 * primary assignee); chips can be removed individually.
 */
export function UserMultiSelect({
  id,
  value,
  onChange,
  users,
  placeholder = "Select people",
  disabled,
  className,
  primaryHint = true,
}: {
  id?: string;
  value: string[];
  onChange: (ids: string[]) => void;
  users: UserOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  primaryHint?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const byId = new Map(users.map((u) => [u.id, u]));
  const selected = value.map((v) => byId.get(v)).filter((u): u is UserOption => Boolean(u));

  function toggle(userId: string) {
    onChange(value.includes(userId) ? value.filter((v) => v !== userId) : [...value, userId]);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className="h-auto min-h-8 w-full justify-between px-2.5 font-normal"
            />
          }
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-left">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selected.map((u, i) => (
                <span
                  key={u.id}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border bg-muted/60 py-0.5 pr-1 pl-0.5 text-xs",
                    i === 0 && primaryHint && "border-primary/40",
                  )}
                >
                  <Avatar className="size-4">
                    <AvatarFallback className="bg-primary/10 text-[8px] text-primary">{getInitials(u.name)}</AvatarFallback>
                  </Avatar>
                  <span className="max-w-28 truncate">{u.name}</span>
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Remove ${u.name}`}
                    className="rounded-full p-0.5 hover:bg-background"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      toggle(u.id);
                    }}
                  >
                    <X className="size-3" />
                  </span>
                </span>
              ))
            )}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--anchor-width) min-w-64 p-0">
          <Command>
            <CommandInput placeholder="Search people…" autoFocus />
            <CommandList className="max-h-64">
              <CommandEmpty>No one found.</CommandEmpty>
              <CommandGroup>
                {users.map((u) => {
                  const active = value.includes(u.id);
                  return (
                    <CommandItem key={u.id} value={`${u.name} ${u.email ?? ""}`} onSelect={() => toggle(u.id)}>
                      <span
                        className={cn(
                          "flex size-4 items-center justify-center rounded-[4px] border",
                          active ? "border-primary bg-primary text-primary-foreground" : "border-input",
                        )}
                      >
                        {active && <Check className="size-3" />}
                      </span>
                      <Avatar className="size-5">
                        <AvatarFallback className="bg-primary/10 text-[9px] text-primary">{getInitials(u.name)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{u.name}</span>
                        {u.email && <span className="block truncate text-xs text-muted-foreground">{u.email}</span>}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {primaryHint && selected.length > 1 && (
        <p className="text-xs text-muted-foreground">
          {selected[0].name} is the primary assignee; the task sits in their monthly plan.
        </p>
      )}
    </div>
  );
}
