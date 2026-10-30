"use client";

import { useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { cn, getInitials } from "@/lib/utils";

export type MentionUser = { id: string; name: string };

/**
 * A textarea with @mentions: typing "@" opens a list of people, picking one
 * inserts "@Name" and remembers the id. The ids of the people whose @Name is
 * still present in the text are what gets submitted.
 */
export function MentionComposer({
  value,
  onChange,
  users,
  placeholder,
  rows = 3,
  disabled,
  autoFocus,
  onSubmit,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  users: MentionUser[];
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  onSubmit?: () => void;
  className?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<{ start: number; text: string } | null>(null);
  const [active, setActive] = useState(0);

  const matches = query
    ? users.filter((u) => u.name.toLowerCase().includes(query.text.toLowerCase())).slice(0, 6)
    : [];
  const open = query !== null && matches.length > 0;

  function detect(text: string, caret: number) {
    const before = text.slice(0, caret);
    const at = before.lastIndexOf("@");
    if (at === -1 || (at > 0 && /\w/.test(before[at - 1]))) {
      setQuery(null);
      return;
    }
    const typed = before.slice(at + 1);
    if (/[\n]/.test(typed) || typed.length > 30) {
      setQuery(null);
      return;
    }
    setQuery({ start: at, text: typed });
    setActive(0);
  }

  function pick(user: MentionUser) {
    if (!query) return;
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const next = `${value.slice(0, query.start)}@${user.name} ${value.slice(caret)}`;
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      if (!el) return;
      const pos = query.start + user.name.length + 2;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className={cn("relative", className)}>
      <Textarea
        ref={ref}
        value={value}
        rows={rows}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={ariaLabel}
        maxLength={2000}
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onClick={(e) => detect(value, e.currentTarget.selectionStart ?? value.length)}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        onKeyDown={(e) => {
          if (open) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % matches.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + matches.length) % matches.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              pick(matches[active]);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setQuery(null);
              return;
            }
          }
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            onSubmit?.();
          }
        }}
      />
      {open && (
        <ul
          role="listbox"
          aria-label="Mention someone"
          className="absolute left-0 z-20 mt-1 w-64 overflow-hidden rounded-lg border bg-popover p-1 text-sm shadow-md"
        >
          {matches.map((u, i) => (
            <li
              key={u.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(u);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5", i === active && "bg-accent")}
            >
              <Avatar className="size-5">
                <AvatarFallback className="bg-primary/10 text-[9px] text-primary">{getInitials(u.name)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{u.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Ids of the users whose "@Name" appears in the text. */
export function mentionedIds(text: string, users: MentionUser[]): string[] {
  return users.filter((u) => text.includes(`@${u.name}`)).map((u) => u.id);
}

/** Splits comment text so "@Name" tokens of known users are highlighted. */
export function renderWithMentions(text: string, users: { id: string; name: string }[], currentUserId?: string): React.ReactNode[] {
  if (users.length === 0) return [text];
  const names = [...users].sort((a, b) => b.name.length - a.name.length);
  const pattern = new RegExp(`@(${names.map((u) => u.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    const user = users.find((u) => u.name === match[1]);
    out.push(
      <span
        key={`${index}-${match[1]}`}
        className={cn(
          "rounded bg-primary/10 px-1 font-medium text-primary",
          user?.id === currentUserId && "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
        )}
      >
        @{match[1]}
      </span>,
    );
    last = index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
