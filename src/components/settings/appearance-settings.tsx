"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const OPTIONS: { value: string; label: string; description: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", description: "Bright surfaces, dark text.", icon: Sun },
  { value: "dark", label: "Dark", description: "Dim surfaces, easier at night.", icon: Moon },
  { value: "system", label: "System", description: "Follows your device setting.", icon: Monitor },
];

const subscribe = () => () => {};

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  // Avoid a hydration mismatch: the theme is only known on the client.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const current = mounted ? (theme ?? "system") : "system";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Choose how the app looks on this device.</CardDescription>
      </CardHeader>
      <CardContent>
        <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-3">
          {OPTIONS.map((o) => {
            const active = current === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTheme(o.value)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent",
                  active && "border-primary bg-primary/5 ring-1 ring-primary/40",
                )}
              >
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md bg-muted", active && "bg-primary/10 text-primary")}>
                  <o.icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{o.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
