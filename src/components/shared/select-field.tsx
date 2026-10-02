"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: React.ReactNode; textLabel?: string };

/**
 * Thin wrapper over the Base UI Select: value "" means "no selection" and is
 * rendered as the placeholder.
 */
export function SelectField({
  value,
  onChange,
  options,
  placeholder = "Select…",
  className,
  size = "default",
  disabled,
  id,
  name,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  size?: "sm" | "default";
  disabled?: boolean;
  id?: string;
  name?: string;
}) {
  const items = options.map((o) => ({ value: o.value, label: o.textLabel ?? (typeof o.label === "string" ? o.label : o.value) }));

  return (
    <Select
      value={value || null}
      onValueChange={(v) => onChange((v as string | null) ?? "")}
      items={items}
      disabled={disabled}
      name={name}
    >
      <SelectTrigger id={id} size={size} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
