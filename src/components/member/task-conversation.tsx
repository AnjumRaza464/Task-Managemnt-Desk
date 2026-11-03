"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CornerDownRight, FileText, ImageIcon, Loader2, MessageCircle, MessagesSquare, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { getTaskMessages, postTaskMessage, type TaskMessage, type TaskMessageAttachment } from "@/actions/task-messages";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MentionComposer, mentionedIds, renderWithMentions, type MentionUser } from "@/components/tasks/mention-composer";
import { MAX_ATTACHMENT_BYTES } from "@/lib/constants";
import { cn, formatBytes, formatDateTime, getInitials, timeAgo } from "@/lib/utils";
import type { CommentKind } from "@/generated/prisma/enums";

const POLL_MS = 5000;

/** A file chip inside a message: images show a preview, everything else a download row. */
export function AttachmentChip({ file, mine = false }: { file: TaskMessageAttachment; mine?: boolean }) {
  const href = `/api/attachments/${file.id}`;
  const isImage = file.mimeType.startsWith("image/");
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "mt-1.5 flex max-w-xs items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition-colors hover:bg-accent",
        mine ? "border-white/20 bg-white/10 text-primary-foreground hover:bg-white/15" : "bg-background",
      )}
    >
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={href} alt={file.fileName} className="size-10 shrink-0 rounded object-cover" />
      ) : (
        <FileText className="size-4 shrink-0 opacity-70" />
      )}
      <span className="min-w-0">
        <span className="block truncate font-medium">{file.fileName}</span>
        <span className="block opacity-70">{formatBytes(file.size)}</span>
      </span>
    </a>
  );
}

/**
 * Right-hand pane of the task modal: a chat (quick messages) and a discussion
 * (threaded comments) with @mentions and file attachments. Messages are on
 * top; the Chat / Discussion switch sits in the composer at the bottom.
 */
export function TaskConversation({
  taskId,
  currentUserId,
  users,
  canPost,
  className,
}: {
  taskId: string;
  currentUserId: string;
  users: MentionUser[];
  canPost: boolean;
  className?: string;
}) {
  const [kind, setKind] = useState<CommentKind>("CHAT");
  const [store, setStore] = useState<Record<CommentKind, { messages: TaskMessage[]; since: string | null; loaded: boolean }>>({
    CHAT: { messages: [], since: null, loaded: false },
    DISCUSSION: { messages: [], since: null, loaded: false },
  });
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [replyTo, setReplyTo] = useState<TaskMessage | null>(null);
  const [sending, startSend] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const current = store[kind];

  // Load on open / switch, then poll for new messages while this kind is shown.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async (since: string | null) => {
      const result = await getTaskMessages({ taskId, kind, since: since ?? undefined });
      if (cancelled) return;
      if (result.ok) {
        const { now, messages } = result.data;
        setStore((prev) => {
          const bucket = prev[kind];
          const known = new Set(bucket.messages.map((m) => m.id));
          const merged = since ? [...bucket.messages, ...messages.filter((m) => !known.has(m.id))] : messages;
          return { ...prev, [kind]: { messages: merged, since: now, loaded: true } };
        });
        timer = setTimeout(() => tick(now), POLL_MS);
      } else {
        timer = setTimeout(() => tick(since), POLL_MS * 2);
      }
    };
    void tick(store[kind].since);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, kind]);

  // Keep the newest message in view.
  const count = current.messages.length;
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, kind]);

  function chooseFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > MAX_ATTACHMENT_BYTES) {
      toast.error("File is larger than 5 MB.");
      e.target.value = "";
      return;
    }
    setFile(f);
  }

  function send() {
    const text = content.trim();
    if (!text && !file) return;
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("kind", kind);
    fd.set("content", text);
    fd.set("mentionIds", JSON.stringify(mentionedIds(text, users)));
    if (replyTo) fd.set("parentId", replyTo.id);
    if (file) fd.set("file", file);
    startSend(async () => {
      const result = await postTaskMessage(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const message = result.data;
      setStore((prev) => ({ ...prev, [kind]: { ...prev[kind], messages: [...prev[kind].messages, message] } }));
      setContent("");
      setFile(null);
      setReplyTo(null);
      if (fileInput.current) fileInput.current.value = "";
    });
  }

  const messages = current.messages;
  const threads = messages.filter((m) => !m.parentId);
  const repliesOf = (id: string) => messages.filter((m) => m.parentId === id);

  function bubble(m: TaskMessage, isReply = false) {
    const mine = m.author.id === currentUserId;
    const mentionUsers = users.filter((u) => m.mentions.some((x) => x.userId === u.id) || m.content.includes(`@${u.name}`));
    return (
      <div key={m.id} className={cn("flex gap-2", mine ? "flex-row-reverse" : "", isReply && "mt-2")}>
        <Avatar className={cn("shrink-0", isReply ? "size-6" : "size-7")}>
          <AvatarFallback className="bg-primary/10 text-[10px] text-primary">{getInitials(m.author.name)}</AvatarFallback>
        </Avatar>
        <div className={cn("flex max-w-[85%] flex-col", mine ? "items-end" : "items-start")}>
          <div className={cn("flex items-center gap-2 text-[11px] text-muted-foreground", mine && "flex-row-reverse")}>
            <span className="font-medium text-foreground">{mine ? "You" : m.author.name}</span>
            <span title={formatDateTime(m.createdAt)}>{timeAgo(m.createdAt)}</span>
          </div>
          <div
            className={cn(
              "mt-0.5 rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
              mine ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-muted",
            )}
          >
            {m.content && <span>{renderWithMentions(m.content, mentionUsers, currentUserId)}</span>}
            {m.attachments.map((f) => (
              <AttachmentChip key={f.id} file={f} mine={mine} />
            ))}
          </div>
          {kind === "DISCUSSION" && !isReply && canPost && (
            <button
              type="button"
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setReplyTo(m)}
            >
              <CornerDownRight className="size-3" /> Reply
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {!current.loaded ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
            {kind === "CHAT" ? <MessageCircle className="size-6" /> : <MessagesSquare className="size-6" />}
            {kind === "CHAT" ? "No messages yet. Start the conversation about this task." : "No discussion yet. Post an update, question or decision."}
          </div>
        ) : (
          threads.map((m) => (
            <div key={m.id}>
              {bubble(m)}
              {kind === "DISCUSSION" && repliesOf(m.id).length > 0 && (
                <div className="mt-1 ml-9 border-l-2 pl-3">{repliesOf(m.id).map((r) => bubble(r, true))}</div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="border-t bg-background/80 p-3">
        {/* Chat / Discussion switch lives at the bottom, next to the composer. */}
        <div className="mb-2 flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            {(["CHAT", "DISCUSSION"] as const).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={kind === k ? "default" : "ghost"}
                className="h-7 px-3"
                onClick={() => {
                  setKind(k);
                  setReplyTo(null);
                }}
              >
                {k === "CHAT" ? <MessageCircle /> : <MessagesSquare />}
                {k === "CHAT" ? "Chat" : "Discussion"}
                {store[k].loaded && store[k].messages.length > 0 && (
                  <span className={cn("text-[10px]", kind === k ? "opacity-80" : "text-muted-foreground")}>{store[k].messages.length}</span>
                )}
              </Button>
            ))}
          </div>
          <span className="hidden text-[11px] text-muted-foreground sm:inline">
            {kind === "CHAT" ? "Quick messages with everyone on this task" : "Threaded updates kept with the task"}
          </span>
        </div>

        {canPost ? (
          <>
            {replyTo && (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted/60 px-2 py-1 text-xs">
                <CornerDownRight className="size-3" /> Replying to <span className="font-medium">{replyTo.author.name}</span>
                <button type="button" className="ml-auto" aria-label="Cancel reply" onClick={() => setReplyTo(null)}>
                  <X className="size-3" />
                </button>
              </div>
            )}
            {file && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border bg-muted/40 px-2 py-1 text-xs">
                {file.type.startsWith("image/") ? <ImageIcon className="size-3.5" /> : <Paperclip className="size-3.5" />}
                <span className="truncate">{file.name}</span>
                <span className="text-muted-foreground">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  className="ml-auto"
                  aria-label="Remove file"
                  onClick={() => {
                    setFile(null);
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                >
                  <X className="size-3" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input ref={fileInput} type="file" className="hidden" onChange={chooseFile} aria-label="Attach a file" />
              <Button type="button" size="icon" variant="outline" aria-label="Attach file" title="Attach a file (max 5 MB)" onClick={() => fileInput.current?.click()}>
                <Paperclip />
              </Button>
              <MentionComposer
                value={content}
                onChange={setContent}
                users={users}
                rows={kind === "CHAT" ? 1 : 2}
                placeholder={kind === "CHAT" ? "Message about this task… @ to mention" : "Write an update… @ to mention"}
                ariaLabel={kind === "CHAT" ? "Chat message" : "Discussion post"}
                onSubmit={send}
                className="min-w-0 flex-1"
              />
              <Button type="button" onClick={send} disabled={sending || (!content.trim() && !file)} aria-label="Send">
                {sending ? <Loader2 className="animate-spin" /> : <Send />} Send
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Enter + Ctrl to send · files up to 5 MB are saved with the task</p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">You can read this conversation but not post in it.</p>
        )}
      </div>
    </div>
  );
}
