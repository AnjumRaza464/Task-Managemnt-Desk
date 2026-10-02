import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "",
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: string;
  href?: string;
}) {
  const body = (
    <CardContent className="flex items-start gap-3">
      <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted", tone)}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums leading-tight">{value}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
    </CardContent>
  );

  return href ? (
    <Link href={href} className="block rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <Card className="h-full hover:bg-accent/40">{body}</Card>
    </Link>
  ) : (
    <Card className="h-full">{body}</Card>
  );
}
