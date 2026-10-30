import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";

export type AssigneeRef = { user: { id: string; name: string } };

/** "Ayesha, Bilal and 2 others" style label. */
export function assigneeLabel(assignees: AssigneeRef[]): string {
  const names = assignees.map((a) => a.user.name);
  if (names.length === 0) return "Unassigned";
  if (names.length <= 2) return names.join(" & ");
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

const SIZES = {
  xs: { avatar: "size-5", text: "text-[9px]", ring: "ring-1" },
  sm: { avatar: "size-6", text: "text-[10px]", ring: "ring-2" },
  md: { avatar: "size-7", text: "text-[10px]", ring: "ring-2" },
} as const;

/**
 * Overlapping avatar stack for a task's assignees. Shows up to `max`
 * avatars and a "+N" bubble for the rest; the full list is in the title.
 */
export function AssigneeAvatars({
  assignees,
  max = 3,
  size = "sm",
  className,
  showNames = false,
}: {
  assignees: AssigneeRef[];
  max?: number;
  size?: keyof typeof SIZES;
  className?: string;
  showNames?: boolean;
}) {
  const s = SIZES[size];
  if (assignees.length === 0) return <span className={cn("text-xs text-muted-foreground", className)}>Unassigned</span>;
  const visible = assignees.slice(0, max);
  const rest = assignees.length - visible.length;
  const title = assignees.map((a) => a.user.name).join(", ");

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)} title={title}>
      <span className="flex -space-x-1.5">
        {visible.map((a) => (
          <Avatar key={a.user.id} className={cn(s.avatar, s.ring, "ring-background")}>
            <AvatarFallback className={cn("bg-primary/10 text-primary", s.text)}>{getInitials(a.user.name)}</AvatarFallback>
          </Avatar>
        ))}
        {rest > 0 && (
          <span
            className={cn(
              "flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-background",
              s.avatar,
              s.text,
              s.ring,
            )}
          >
            +{rest}
          </span>
        )}
      </span>
      {showNames && <span className="truncate text-sm">{assigneeLabel(assignees)}</span>}
    </span>
  );
}
