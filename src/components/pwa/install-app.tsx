"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, MonitorDown, Share, Smartphone, SquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { BrandMark } from "@/components/shared/brand-logo";
import { getInstallPrompt, installPlatform, isStandalone, runInstallPrompt, subscribeInstall } from "@/lib/pwa-install";

function useInstallState() {
  const available = useSyncExternalStore(subscribeInstall, () => Boolean(getInstallPrompt()), () => false);
  const standalone = useSyncExternalStore(subscribeInstall, isStandalone, () => true);
  return { available, standalone };
}

/** Shared behaviour: native prompt when the browser offers one, otherwise step-by-step help. */
export function useInstallApp() {
  const { available, standalone } = useInstallState();
  const [helpOpen, setHelpOpen] = useState(false);

  async function install() {
    const result = await runInstallPrompt();
    if (result === null) {
      setHelpOpen(true);
      return;
    }
    if (result) toast.success("UniKyn installed. Find it on your home screen or app list.");
  }

  return { available, standalone, install, helpOpen, setHelpOpen };
}

/** Browser-specific instructions for when the native prompt is not available. */
export function InstallHelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const platform = typeof window === "undefined" ? "desktop" : installPlatform();
  const steps: { title: string; items: React.ReactNode[] }[] =
    platform === "ios"
      ? [
          {
            title: "iPhone / iPad (Safari)",
            items: [
              <>
                Open this page in <b>Safari</b>, then tap the Share button <Share className="inline size-3.5 text-primary" />.
              </>,
              <>
                Choose <b>Add to Home Screen</b> <SquarePlus className="inline size-3.5 text-primary" />.
              </>,
              <>
                Tap <b>Add</b>. The UniKyn icon appears on your home screen.
              </>,
            ],
          },
        ]
      : platform === "android"
        ? [
            {
              title: "Android (Chrome)",
              items: [
                <>
                  Tap the Chrome menu <b>⋮</b> at the top right.
                </>,
                <>
                  Choose <b>Install app</b> (or <b>Add to Home screen</b>) and confirm.
                </>,
                <>The UniKyn icon appears on your home screen and opens full screen.</>,
              ],
            },
          ]
        : [
            {
              title: "Windows / Mac (Chrome or Edge)",
              items: [
                <>
                  Click the <b>install icon</b> <MonitorDown className="inline size-3.5 text-primary" /> at the right end of the address bar, then <b>Install</b>.
                </>,
                <>
                  No icon? Chrome menu <b>⋮</b> → <b>Cast, save and share</b> → <b>Install page as app</b>. Edge menu <b>…</b> → <b>Apps</b> → <b>Install this site as an app</b>.
                </>,
                <>UniKyn opens in its own window; pin it to the taskbar or Dock like any app.</>,
              ],
            },
            {
              title: "On your phone",
              items: [
                <>
                  Open <b>{typeof window === "undefined" ? "this site" : window.location.origin}</b> on the phone: Android shows an Install prompt, iPhone uses Share → Add to Home Screen.
                </>,
              ],
            },
          ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BrandMark className="size-8" /> Install UniKyn
          </DialogTitle>
          <DialogDescription>Get an app icon and open your projects full screen, no browser needed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {steps.map((s) => (
            <div key={s.title} className="space-y-2 rounded-xl border bg-muted/40 p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                {s.title.startsWith("On your phone") ? <Smartphone className="size-4 text-primary" /> : <Download className="size-4 text-primary" />}
                {s.title}
              </p>
              <ol className="space-y-1.5 text-sm text-muted-foreground">
                {s.items.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-semibold text-foreground">{i + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Already installed? Open UniKyn from your home screen or app list instead of the browser.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Header icon button: hidden once the app runs installed. */
export function InstallAppButton() {
  const { standalone, install, helpOpen, setHelpOpen } = useInstallApp();
  if (standalone) return null;
  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Install app" title="Install UniKyn as an app" onClick={install}>
        <Download className="size-4" />
      </Button>
      <InstallHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}

/** Entry for the user dropdown; hidden once the app runs installed. */
export function InstallAppMenuItem() {
  const { standalone, install, helpOpen, setHelpOpen } = useInstallApp();
  if (standalone) return null;
  return (
    <>
      <DropdownMenuItem onClick={() => void install()}>
        <Download /> Install app
      </DropdownMenuItem>
      <InstallHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
