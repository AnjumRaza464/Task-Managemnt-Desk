"use client";

/**
 * Captures the browser's install prompt as soon as the client bundle loads,
 * so any button on the page can trigger it later (the event often fires
 * before React mounts and is lost otherwise).
 */
export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

export function subscribeInstall(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getInstallPrompt() {
  return deferred;
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    installed ||
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export type InstallPlatform = "ios" | "android" | "desktop";

export function installPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

/** Runs the native prompt; resolves true when the user accepted. Returns null when no prompt is available. */
export async function runInstallPrompt(): Promise<boolean | null> {
  const p = deferred;
  if (!p) return null;
  await p.prompt();
  const { outcome } = await p.userChoice;
  deferred = null;
  notify();
  return outcome === "accepted";
}
