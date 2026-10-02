"use client";

import { SearchInput } from "@/components/shared/search-input";
import { SelectField } from "@/components/shared/select-field";
import { useQueryState } from "@/hooks/use-query-state";
import { ROLE_LABELS, ROLES } from "@/lib/constants";

export function UserFilters() {
  const { get, set } = useQueryState();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <SearchInput placeholder="Search name, email, department…" className="sm:w-72" />
      <SelectField
        value={get("role")}
        onChange={(v) => set({ role: v })}
        placeholder="All roles"
        className="sm:w-40"
        options={[{ value: "ALL", label: "All roles" }, ...ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))]}
      />
      <SelectField
        value={get("status")}
        onChange={(v) => set({ status: v })}
        placeholder="All statuses"
        className="sm:w-40"
        options={[
          { value: "all", label: "All statuses" },
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
        ]}
      />
    </div>
  );
}
