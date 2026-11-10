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
  onPasteFile,
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
  /** Called with an image pasted from the clipboard (Ctrl+V) instead of inserting it as text. */
  onPasteFile?: (file: File) => void;
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
        onPaste={(e) => {
          if (!onPasteFile) return;
          const file = pastedImage(e.clipboardData);
          if (!file) return;
          e.preventDefault();
          onPasteFile(file);
        }}
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

/** The first image in a paste (e.g. a screenshot or a copied picture), named so it is recognisable in the file list. */
function pastedImage(data: DataTransfer): File | null {
  const item = Array.from(data.items).find((i) => i.kind === "file" && i.type.startsWith("image/"));
  const file = item?.getAsFile();
  if (!file) return null;
  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  return new File([file], `pasted-image-${stamp}.${ext}`, { type: file.type });
}

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The words of a name that can stand in for it: "Muhammad Ali" → ["Muhammad", "Ali"]. */
const nameParts = (name: string) => name.trim().split(/\s+/).filter((part) => part.length >= 2);

/**
 * "@Full Name" or any single "@Word" of a known user's name, in any letter
 * case, not followed by more word characters (so "@ali" is not part of "@alice").
 */
function mentionPattern(users: { name: string }[]): RegExp | null {
  const alternatives = new Set<string>();
  for (const u of users) {
    if (u.name.trim()) alternatives.add(escapeRe(u.name.trim()));
    for (const part of nameParts(u.name)) alternatives.add(escapeRe(part));
  }
  if (alternatives.size === 0) return null;
  // Longest first so "Muhammad Ali" wins over "Muhammad".
  const sorted = [...alternatives].sort((a, b) => b.length - a.length);
  return new RegExp(`@(${sorted.join("|")})(?![\\p{L}\\p{N}_])`, "giu");
}

/** Users a typed "@token" refers to: full name or any word of the name, case-insensitive. */
function usersFor<T extends { name: string }>(token: string, users: T[]): T[] {
  const needle = token.toLowerCase();
  return users.filter((u) => u.name.trim().toLowerCase() === needle || nameParts(u.name).some((part) => part.toLowerCase() === needle));
}

/** Ids of the users whose "@Name" (or "@AnyWordOfTheName") appears in the text. */
export function mentionedIds(text: string, users: MentionUser[]): string[] {
  const pattern = mentionPattern(users);
  if (!pattern) return [];
  const ids = new Set<string>();
  for (const match of text.matchAll(pattern)) for (const u of usersFor(match[1], users)) ids.add(u.id);
  return [...ids];
}

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;

/** Turns http(s):// and www. URLs in plain text into links that open in a new tab. */
export function renderWithLinks(text: string, keyPrefix = ""): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0;
    // Trailing punctuation belongs to the sentence, not the URL.
    let url = match[0];
    const trailing = url.match(/[.,;:!?)\]]+$/)?.[0] ?? "";
    url = url.slice(0, url.length - trailing.length);
    if (index > last) out.push(text.slice(last, index));
    out.push(
      <a
        key={`${keyPrefix}${index}`}
        href={url.startsWith("www.") ? `https://${url}` : url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all underline underline-offset-2 hover:opacity-80"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>,
    );
    last = index + url.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * Splits comment text so "@Name" / "@NamePart" tokens of known users are
 * highlighted and URLs are clickable. `onPrimary` picks colours that stay
 * readable inside the sender's own (primary-coloured) chat bubble.
 */
export function renderWithMentions(
  text: string,
  users: { id: string; name: string }[],
  currentUserId?: string,
  onPrimary = false,
): React.ReactNode[] {
  const pattern = mentionPattern(users);
  if (!pattern) return renderWithLinks(text);
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) out.push(...renderWithLinks(text.slice(last, index), `${last}-`));
    const isMe = usersFor(match[1], users).some((u) => u.id === currentUserId);
    out.push(
      <span
        key={`${index}-${match[1]}`}
        className={cn(
          "rounded px-1 font-semibold",
          onPrimary ? "bg-white/25 text-primary-foreground" : "bg-primary/10 text-primary",
          isMe && (onPrimary ? "bg-amber-300 text-amber-950" : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"),
        )}
      >
        @{match[1]}
      </span>,
    );
    last = index + match[0].length;
  }
  if (last < text.length) out.push(...renderWithLinks(text.slice(last), `${last}-`));
  return out;
}
