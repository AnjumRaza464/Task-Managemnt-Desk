"use client";

import { Check } from "lucide-react";
import { PROJECT_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PROJECT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Use color ${color}`}
          aria-pressed={value === color}
          onClick={() => onChange(color)}
          className={cn(
            "flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow",
            value === color && "ring-2 ring-foreground/60",
          )}
          style={{ backgroundColor: color }}
        >
          {value === color && <Check className="size-3.5 text-white" />}
        </button>
      ))}
      <input
        type="color"
        aria-label="Custom color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="size-7 cursor-pointer rounded-full border bg-transparent p-0"
      />
    </div>
  );
}
