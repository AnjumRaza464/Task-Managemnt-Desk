"use client";

import { FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/shared/search-input";
import { SelectField } from "@/components/shared/select-field";
import { useQueryState } from "@/hooks/use-query-state";
import { MONTH_NAMES, PRIORITIES, PRIORITY_LABELS, STATUS_LABELS, TASK_STATUSES } from "@/lib/constants";
import { monthKey } from "@/lib/utils";
import type { TaskFormOptions } from "@/lib/queries/tasks";

function monthOptions() {
  const now = new Date();
  const items: { value: string; label: string }[] = [];
  for (let offset = -6; offset <= 6; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    items.push({ value: monthKey(d.getFullYear(), d.getMonth() + 1), label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` });
  }
  return items.reverse();
}

export function TaskFilters({
  options,
  showUser = true,
  showMonth = true,
  showDates = true,
}: {
  options: TaskFormOptions;
  showUser?: boolean;
  showMonth?: boolean;
  showDates?: boolean;
}) {
  const { get, set, clear, searchParams } = useQueryState();
  const hasFilters = ["q", "user", "month", "status", "priority", "category", "dueFrom", "dueTo"].some((k) => searchParams.get(k));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search tasks…" className="w-full sm:w-64" />
        {showUser && (
          <SelectField
            value={get("user")}
            onChange={(v) => set({ user: v })}
            placeholder="All users"
            className="w-full sm:w-44"
            options={[{ value: "", label: "All users" }, ...options.users.map((u) => ({ value: u.id, label: u.name }))].filter((o) => o.value)}
          />
        )}
        {showMonth && (
          <SelectField
            value={get("month")}
            onChange={(v) => set({ month: v })}
            placeholder="All months"
            className="w-full sm:w-40"
            options={monthOptions()}
          />
        )}
        <SelectField
          value={get("status")}
          onChange={(v) => set({ status: v })}
          placeholder="All statuses"
          className="w-full sm:w-36"
          options={TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
        />
        <SelectField
          value={get("priority")}
          onChange={(v) => set({ priority: v })}
          placeholder="All priorities"
          className="w-full sm:w-36"
          options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
        />
        <SelectField
          value={get("category")}
          onChange={(v) => set({ category: v })}
          placeholder="All categories"
          className="w-full sm:w-40"
          options={[{ value: "none", label: "Uncategorized" }, ...options.categories.map((c) => ({ value: c.id, label: c.name }))]}
        />
        {showDates && (
          <div className="flex items-center gap-1">
            <Input type="date" aria-label="Due from" value={get("dueFrom")} onChange={(e) => set({ dueFrom: e.target.value })} className="w-36" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" aria-label="Due to" value={get("dueTo")} onChange={(e) => set({ dueTo: e.target.value })} className="w-36" />
          </div>
        )}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clear}>
            <FilterX /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}
