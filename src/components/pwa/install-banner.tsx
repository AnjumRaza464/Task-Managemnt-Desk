"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shared/brand-logo";
import { cn } from "@/lib/utils";
import { getInstallPrompt, isStandalone, runInstallPrompt, subscribeInstall } from "@/lib/pwa-install";

const DISMISS_KEY = "unikyn-install-dismissed";
const DISMISS_DAYS = 7;

function readState() {
  if (typeof window === "undefined") return { standalone: true, ios: false, dismissed: true };
  const standalone = isStandalone();
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let dismissed = false;
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    dismissed = until > Date.now();
  } catch {
    dismissed = false;
  }
  return { standalone, ios, dismissed };
}

/**
 * "Install UniKyn" banner. On Android/desktop Chrome it triggers the native
 * install prompt; on iPhone/iPad (which has no prompt) it explains
 * Share → Add to Home Screen. Hidden once the app runs installed.
 */
export function InstallBanner({ className, variant = "bar" }: { className?: string; variant?: "bar" | "card" }) {
  const [state, setState] = useState(readState);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const prompt = useSyncExternalStore(subscribeInstall, () => Boolean(getInstallPrompt()), () => false);
  const installedNow = useSyncExternalStore(subscribeInstall, isStandalone, () => true);

  if (state.standalone || installedNow || state.dismissed) return null;
  // Nothing to offer: not iOS and the browser has not said the app is installable (yet).
  if (!state.ios && !prompt) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86_400_000));
    } catch {}
    setState((s) => ({ ...s, dismissed: true }));
  }

  async function install() {
    const result = await runInstallPrompt();
    if (result === null) {
      setShowIosHelp(true);
      return;
    }
    if (result) setState((s) => ({ ...s, standalone: true }));
  }

  return (
    <div
      role="region"
      aria-label="Install the app"
      className={cn(
        "pointer-events-auto flex flex-col gap-3 rounded-2xl border border-primary/30 bg-card/90 p-3 text-card-foreground shadow-lg backdrop-blur-md",
        variant === "bar" && "sm:flex-row sm:items-center",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <BrandMark className="size-10" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Install UniKyn on your phone</p>
          <p className="text-xs text-muted-foreground">Get an app icon and open your tasks full screen, no browser needed.</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" onClick={install}>
          <Download /> Install app
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Not now" onClick={dismiss}>
          <X />
        </Button>
      </div>
      {showIosHelp && (
        <ol className="w-full space-y-1.5 rounded-xl bg-muted/60 p-3 text-xs sm:basis-full">
          <li className="flex items-center gap-2">
            <span className="font-semibold">1.</span> Open this page in <span className="font-medium">Safari</span>, then tap the Share button{" "}
            <Share className="size-3.5 text-primary" />.
          </li>
          <li className="flex items-center gap-2">
            <span className="font-semibold">2.</span> Choose <span className="font-medium">Add to Home Screen</span> <SquarePlus className="size-3.5 text-primary" />.
          </li>
          <li className="flex items-center gap-2">
            <span className="font-semibold">3.</span> Tap <span className="font-medium">Add</span>. The UniKyn icon appears on your home screen.
          </li>
        </ol>
      )}
    </div>
  );
}
