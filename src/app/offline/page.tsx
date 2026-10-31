import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";

export const metadata: Metadata = { title: "Offline" };

/** Shown by the service worker when a page cannot be loaded without a connection. */
export default function OfflinePage() {
  return (
    <div className="dark flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-8 text-center text-foreground">
      <BrandLogo plain className="h-10" />
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
        <WifiOff className="size-7" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">You are offline</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          UniKyn needs an internet connection to load your tasks and projects. Reconnect and try again.
        </p>
      </div>
      <a href="/" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
        Try again
      </a>
    </div>
  );
}
