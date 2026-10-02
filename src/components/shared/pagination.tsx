"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryState } from "@/hooks/use-query-state";

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
}) {
  const { set } = useQueryState();
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
      <span>
        Showing {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => set({ page: String(page - 1) }, { resetPage: false })}
        >
          <ChevronLeft /> Prev
        </Button>
        <span className="px-2 tabular-nums">
          {page} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => set({ page: String(page + 1) }, { resetPage: false })}
        >
          Next <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
