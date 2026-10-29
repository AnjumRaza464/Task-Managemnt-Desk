"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavPending } from "@/components/layout/nav-pending";

export function MemberNav({ unseenFiles }: { unseenFiles: number }) {
  const pathname = usePathname();
  const items = [
    { href: "/my-tasks", label: "My tasks", badge: 0 },
    { href: "/my-files", label: "Files", badge: unseenFiles },
  ];

  return (
    <nav className="flex items-center gap-1" aria-label="Sections">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-accent",
              active ? "bg-accent font-medium" : "text-muted-foreground",
            )}
          >
            {item.label}
            <NavPending className="ml-1.5" />
            {item.badge > 0 && (
              <span className="ml-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
