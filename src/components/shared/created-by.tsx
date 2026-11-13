import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";

/** Who created a task: a small avatar with the name, for table cells. */
export function CreatedBy({ user, className }: { user: { id: string; name: string } | null | undefined; className?: string }) {
  if (!user) return <span className={cn("text-sm text-muted-foreground", className)}>—</span>;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)} title={`Created by ${user.name}`}>
      <Avatar className="size-6">
        <AvatarFallback className="bg-muted text-[10px] text-muted-foreground">{getInitials(user.name)}</AvatarFallback>
      </Avatar>
      <span className="truncate text-sm">{user.name}</span>
    </span>
  );
}
