"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format, formatDistanceToNow, isSameYear, isToday, isYesterday } from "date-fns";
import { ArrowLeft, Loader2, MessageCircle, MessageSquare, Send, Users, X } from "lucide-react";
import { toast } from "sonner";
import { sendChatMessage } from "@/actions/chat";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ROLE_LABELS } from "@/lib/constants";
import {
  CHAT_MESSAGE_MAX_LENGTH,
  TEAM_CHANNEL_ID,
  type ChatContact,
  type ChatMessageDto,
  type ChatSyncRequest,
  type ChatSyncResponse,
} from "@/lib/chat-types";
import { cn, getInitials } from "@/lib/utils";
import type { CurrentUser } from "@/lib/auth-guard";

/** Poll intervals: a conversation or the team channel open, contact list open, panel closed. */
const POLL_THREAD_MS = 3_000;
const POLL_LIST_MS = 6_000;
const POLL_CLOSED_MS = 15_000;
/** Overlap added to incremental fetches so nothing is missed at the boundary. */
const SINCE_OVERLAP_MS = 5_000;

type Tab = "team" | "direct";
type Threads = Record<string, ChatMessageDto[]>;

function mergeMessages(existing: ChatMessageDto[], incoming: ChatMessageDto[]): ChatMessageDto[] {
  if (incoming.length === 0) return existing;
  const byId = new Map(existing.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id.localeCompare(b.id),
  );
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, isSameYear(date, new Date()) ? "EEE, MMM d" : "MMM d, yyyy");
}

function presenceText(contact: ChatContact): string {
  if (contact.online) return "Online";
  if (contact.lastSeenAt) return `Last seen ${formatDistanceToNow(new Date(contact.lastSeenAt), { addSuffix: true })}`;
  return "Offline";
}

function formatCount(n: number) {
  return n > 99 ? "99+" : String(n);
}

function PresenceDot({ online, className }: { online: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full ring-2 ring-background",
        online ? "bg-emerald-500" : "bg-muted-foreground/40",
        className,
      )}
    />
  );
}

function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground",
        className,
      )}
    >
      {formatCount(count)}
    </span>
  );
}

function MessageList({
  messages,
  currentUserId,
  showNames,
}: {
  messages: ChatMessageDto[];
  currentUserId: string;
  showNames: boolean;
}) {
  return (
    <ol className="space-y-1.5">
      {messages.map((m, i) => {
        const mine = m.senderId === currentUserId;
        const prev = messages[i - 1];
        const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
        const sameSenderAsPrev = !newDay && prev?.senderId === m.senderId;
        return (
          <li key={m.id} className="space-y-1.5">
            {newDay && (
              <div className="flex items-center gap-2 py-2 text-[11px] text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                {dayLabel(m.createdAt)}
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
            <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className="max-w-[80%]">
                {showNames && !mine && !sameSenderAsPrev && (
                  <p className="mb-0.5 ml-1 text-[11px] font-medium text-muted-foreground">{m.senderName}</p>
                )}
                <div
                  className={cn(
                    "rounded-2xl px-3 py-1.5 text-sm wrap-break-word whitespace-pre-wrap",
                    mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted",
                  )}
                >
                  {m.content}
                  <span
                    className={cn(
                      "mt-0.5 block text-right text-[10px]",
                      mine ? "text-primary-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    {format(new Date(m.createdAt), "h:mm a")}
                  </span>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ChatWidget({ currentUser }: { currentUser: CurrentUser }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("team");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [teamUnread, setTeamUnread] = useState(0);
  const [threads, setThreads] = useState<Threads>({});
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sinceRef = useRef<Record<string, string>>({});
  const inFlight = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /** What the widget is looking at: the team channel, a direct thread, or nothing. */
  const target = !open ? null : tab === "team" ? TEAM_CHANNEL_ID : activeId;

  const sync = useCallback(async (withId: string | null) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const body: ChatSyncRequest = {};
      if (withId) {
        body.with = withId;
        const since = sinceRef.current[withId];
        if (since) body.since = since;
      }
      const res = await fetch("/api/chat/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      if (res.status === 401) {
        setError("Your session has expired. Please sign in again.");
        return;
      }
      if (!res.ok) throw new Error(`Sync failed (${res.status})`);
      const data: ChatSyncResponse = await res.json();
      setContacts(data.contacts);
      setTeamUnread(data.teamUnread);
      if (withId && data.messages) {
        const incoming = data.messages;
        setThreads((prev) => ({ ...prev, [withId]: mergeMessages(prev[withId] ?? [], incoming) }));
        sinceRef.current[withId] = new Date(Date.parse(data.now) - SINCE_OVERLAP_MS).toISOString();
      }
      setError(null);
    } catch {
      setError("Cannot reach the server. Retrying…");
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Poll loop: faster while a thread is open, slow heartbeat while closed.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const interval = !open ? POLL_CLOSED_MS : target ? POLL_THREAD_MS : POLL_LIST_MS;

    async function tick() {
      if (cancelled) return;
      if (document.visibilityState === "visible") await sync(target);
      if (!cancelled) timer = setTimeout(tick, interval);
    }
    void tick();

    const onVisible = () => {
      if (document.visibilityState === "visible") void sync(target);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [open, target, sync]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const thread = target ? threads[target] : undefined;
  const activeContact = tab === "direct" && activeId ? contacts.find((c) => c.id === activeId) : undefined;
  const inDirectThread = tab === "direct" && activeId !== null;

  // Keep the newest message in view unless the user scrolled up to read history.
  useEffect(() => {
    const el = listRef.current;
    if (!el || !stickToBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }, [thread, target]);

  useEffect(() => {
    if (open && target) inputRef.current?.focus();
  }, [open, target]);

  function switchTab(next: Tab) {
    stickToBottom.current = true;
    setDraft("");
    setTab(next);
    if (next === "team") setTeamUnread(0);
  }

  function openThread(id: string) {
    stickToBottom.current = true;
    setDraft("");
    setActiveId(id);
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }

  function onListScroll() {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function send() {
    const content = draft.trim();
    if (!content || !target || sending) return;
    setSending(true);
    const result = await sendChatMessage({ to: target, content });
    setSending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const message = result.data;
    setDraft("");
    stickToBottom.current = true;
    setThreads((prev) => ({ ...prev, [target]: mergeMessages(prev[target] ?? [], [message]) }));
    if (target !== TEAM_CHANNEL_ID) {
      setContacts((prev) => prev.map((c) => (c.id === target ? { ...c, lastMessageAt: message.createdAt } : c)));
    }
    inputRef.current?.focus();
  }

  const directUnread = contacts.reduce((sum, c) => sum + c.unread, 0);
  const unreadTotal = directUnread + teamUnread;
  const onlineCount = contacts.filter((c) => c.online).length;
  const canSend = target === TEAM_CHANNEL_ID || !!activeContact;

  return (
    <>
      {!open && (
        <Button
          size="icon-lg"
          className="fixed right-4 bottom-4 z-40 size-12 rounded-full shadow-lg"
          aria-label={unreadTotal > 0 ? `Open chat, ${unreadTotal} unread` : "Open chat"}
          onClick={() => setOpen(true)}
        >
          <MessageCircle className="size-5" />
          {unreadTotal > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-white ring-2 ring-background">
              {formatCount(unreadTotal)}
            </span>
          )}
        </Button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Chat"
          className="fixed right-4 bottom-4 z-40 flex h-[min(560px,calc(100dvh-5rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl"
        >
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
            {inDirectThread ? (
              <>
                <Button variant="ghost" size="icon-sm" aria-label="Back to contacts" onClick={() => setActiveId(null)}>
                  <ArrowLeft />
                </Button>
                <div className="relative">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary/10 text-xs text-primary">
                      {getInitials(activeContact?.name ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                  <PresenceDot online={!!activeContact?.online} className="absolute -right-0.5 -bottom-0.5" />
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-medium">{activeContact?.name ?? "Unavailable user"}</p>
                  <p className={cn("truncate text-xs", activeContact?.online ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                    {activeContact ? presenceText(activeContact) : "This user is no longer active"}
                  </p>
                </div>
              </>
            ) : (
              <div className="min-w-0 flex-1 pl-2 leading-tight">
                <p className="text-sm font-medium">{tab === "team" ? "Team chat" : "Direct messages"}</p>
                <p className="text-xs text-muted-foreground">
                  {tab === "team" ? "Visible to everyone · " : ""}
                  {onlineCount === 0 ? "No one else is online" : `${onlineCount} online`}
                </p>
              </div>
            )}
            <Button variant="ghost" size="icon-sm" aria-label="Close chat" onClick={() => setOpen(false)}>
              <X />
            </Button>
          </header>

          {!inDirectThread && (
            <div role="tablist" aria-label="Chat type" className="grid shrink-0 grid-cols-2 gap-1 border-b p-1">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "team"}
                onClick={() => switchTab("team")}
                className={cn(
                  "flex h-8 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors",
                  tab === "team" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Users className="size-4" /> Team
                <CountBadge count={teamUnread} className={cn(tab === "team" && "bg-primary-foreground text-primary")} />
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "direct"}
                onClick={() => switchTab("direct")}
                className={cn(
                  "flex h-8 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors",
                  tab === "direct" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <MessageSquare className="size-4" /> Direct
                <CountBadge count={directUnread} className={cn(tab === "direct" && "bg-primary-foreground text-primary")} />
              </button>
            </div>
          )}

          {error && <p className="border-b bg-destructive/10 px-3 py-1.5 text-xs text-destructive">{error}</p>}

          {tab === "direct" && !activeId ? (
            <div className="flex-1 overflow-y-auto">
              {contacts.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">No other active users yet.</p>
              ) : (
                <ul className="divide-y">
                  {contacts.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => openThread(c.id)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                      >
                        <div className="relative">
                          <Avatar className="size-9">
                            <AvatarFallback className="bg-primary/10 text-xs text-primary">{getInitials(c.name)}</AvatarFallback>
                          </Avatar>
                          <PresenceDot online={c.online} className="absolute -right-0.5 -bottom-0.5" />
                        </div>
                        <div className="min-w-0 flex-1 leading-tight">
                          <div className="flex items-center gap-2">
                            <p className={cn("truncate text-sm", c.unread > 0 ? "font-semibold" : "font-medium")}>{c.name}</p>
                            <span className="shrink-0 text-[10px] tracking-wide text-muted-foreground uppercase">{ROLE_LABELS[c.role]}</span>
                          </div>
                          <p className={cn("truncate text-xs", c.online ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                            {c.online ? "Online" : c.designation || presenceText(c)}
                          </p>
                        </div>
                        <CountBadge count={c.unread} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              <div ref={listRef} onScroll={onListScroll} className="flex-1 overflow-y-auto px-3 py-3">
                {!thread ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Loader2 className="size-5 animate-spin" />
                  </div>
                ) : thread.length === 0 ? (
                  <p className="pt-10 text-center text-sm text-muted-foreground">
                    {tab === "team"
                      ? "No team messages yet. Start the conversation."
                      : `No messages yet. Say hello to ${activeContact?.name ?? "them"}.`}
                  </p>
                ) : (
                  <MessageList messages={thread} currentUserId={currentUser.id} showNames={tab === "team"} />
                )}
              </div>

              <form
                className="flex shrink-0 items-end gap-2 border-t p-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <Textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder={
                    tab === "team" ? "Message the whole team…" : activeContact ? `Message ${activeContact.name}…` : "Message…"
                  }
                  aria-label="Message"
                  rows={1}
                  maxLength={CHAT_MESSAGE_MAX_LENGTH}
                  disabled={!canSend || sending}
                  className="max-h-32 min-h-9 flex-1 resize-none py-2"
                />
                <Button type="submit" size="icon" aria-label="Send" disabled={!canSend || sending || !draft.trim()}>
                  {sending ? <Loader2 className="animate-spin" /> : <Send />}
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
