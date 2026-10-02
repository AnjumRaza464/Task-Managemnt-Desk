"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Small helper to read/update URL search params (server-driven filters). */
export function useQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const get = useCallback((key: string) => searchParams.get(key) ?? "", [searchParams]);

  const set = useCallback(
    (updates: Record<string, string | null | undefined>, options: { resetPage?: boolean } = { resetPage: true }) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === "") params.delete(key);
        else params.set(key, value);
      }
      if (options.resetPage) params.delete("page");
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  const clear = useCallback(() => {
    startTransition(() => router.replace(pathname, { scroll: false }));
  }, [pathname, router]);

  return { get, set, clear, pending, searchParams };
}
