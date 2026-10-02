"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQueryState } from "@/hooks/use-query-state";
import { cn } from "@/lib/utils";

export function SearchInput({
  placeholder = "Search…",
  paramKey = "q",
  className,
}: {
  placeholder?: string;
  paramKey?: string;
  className?: string;
}) {
  const { get, set } = useQueryState();
  const current = get(paramKey);
  const [value, setValue] = useState(current);
  // Adopt the URL value when it changes externally (e.g. "Clear" or back navigation).
  const [prevCurrent, setPrevCurrent] = useState(current);
  if (current !== prevCurrent) {
    setPrevCurrent(current);
    setValue(current);
  }

  useEffect(() => {
    if (value === current) return;
    const t = setTimeout(() => set({ [paramKey]: value }), 350);
    return () => clearTimeout(t);
  }, [value, current, paramKey, set]);

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-8 pr-8"
        aria-label={placeholder}
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
