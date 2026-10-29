"use client";

import { useLinkStatus } from "next/link";
import { Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Nav icon that turns into a spinner while the surrounding <Link> is still
 * navigating (prefetch not done yet, slow network, dev mode). Fixed size, so
 * nothing shifts. Must render inside a <Link>.
 */
export function NavLinkIcon({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span className={cn("relative inline-flex size-4 shrink-0 items-center justify-center", className)}>
      <Icon className={cn("transition-opacity", pending ? "opacity-0 delay-150" : "opacity-100")} />
      <Loader2
        aria-hidden
        className={cn("absolute animate-spin transition-opacity", pending ? "opacity-100 delay-150" : "opacity-0")}
      />
    </span>
  );
}

/** Small always-rendered spinner slot for text-only links; fades in while pending. */
export function NavPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-3.5 shrink-0 items-center justify-center transition-opacity",
        pending ? "opacity-100 delay-150" : "opacity-0",
        className,
      )}
    >
      <Loader2 className="size-3.5 animate-spin" />
    </span>
  );
}
