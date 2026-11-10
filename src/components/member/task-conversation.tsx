"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CornerDownRight, FileText, ImageIcon, Loader2, MessageCircle, MessagesSquare, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { getTaskMessages, postTaskMessage, type TaskMessage, type TaskMessageAttachment } from "@/actions/task-messages";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MentionComposer, mentionedIds, renderWithMentions, type MentionUser } from "@/components/tasks/mention-composer";
import { MAX_ATTACHMENT_BYTES } from "@/lib/constants";
import { cn, formatBytes, formatDateTime, getInitials, timeAgo } from "@/lib/utils";
import type { CommentKind } from "@/generated/prisma/enums";

const POLL_MS = 5000;

/** A file chip inside a message: images show a large preview, everything else a download row. */
export function AttachmentChip({ file, mine = false }: { file: TaskMessageAttachment; mine?: boolean }) {
  const href = `/api/attachments/${file.id}`;
  const isImage = file.mimeType.startsWith("image/");
  if (isImage) return <ImageAttachment file={file} href={href} mine={mine} />;
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
      <FileText className="size-4 shrink-0 opacity-70" />
      <span className="min-w-0">
        <span className="block truncate font-medium">{file.fileName}</span>
        <span className="block opacity-70">{formatBytes(file.size)}</span>
      </span>
    </a>
  );
}

/**
 * An image in a message: a large inline preview that opens full-size in a
 * lightbox right here (no new tab). Right-click the picture to save it.
 */
function ImageAttachment({ file, href, mine }: { file: TaskMessageAttachment; href: string; mine: boolean }) {
  const [open, setOpen] = useState(false);
  const label = `${file.fileName} · ${formatBytes(file.size)}`;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-1.5 block max-w-sm cursor-zoom-in text-left" title={`${label} · click to view`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={href} alt={file.fileName} loading="lazy" className="max-h-72 w-auto max-w-full rounded-lg border bg-background object-contain" />
        <span className={cn("mt-0.5 block truncate text-[11px]", mine ? "text-primary-foreground/80" : "text-muted-foreground")}>{label}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-auto max-w-[95vw] gap-2 bg-black/90 p-2 text-white ring-white/10 sm:max-w-[95vw] [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:hover:bg-white/15">
          <DialogTitle className="sr-only">{file.fileName}</DialogTitle>
          <DialogDescription className="sr-only">Image preview. Right-click the image to save it.</DialogDescription>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={href} alt={file.fileName} className="max-h-[85vh] max-w-[90vw] rounded-md object-contain" />
          <p className="truncate px-1 text-center text-xs text-white/70">{label}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Picked-file chip shown above a composer. */
function PendingFile({ file, onClear }: { file: File; onClear: () => void }) {
  return (
    <div className="mb-2 flex items-center gap-2 rounded-lg border bg-muted/40 px-2 py-1 text-xs">
      {file.type.startsWith("image/") ? <ImageIcon className="size-3.5" /> : <Paperclip className="size-3.5" />}
      <span className="truncate">{file.name}</span>
      <span className="text-muted-foreground">{formatBytes(file.size)}</span>
      <button type="button" className="ml-auto" aria-label="Remove file" onClick={onClear}>
        <X className="size-3" />
      </button>
    </div>
  );
}

function pickFile(e: React.ChangeEvent<HTMLInputElement>, set: (f: File | null) => void) {
  const f = e.target.files?.[0] ?? null;
  if (f && f.size > MAX_ATTACHMENT_BYTES) {
    toast.error("File is larger than 5 MB.");
    e.target.value = "";
    return;
  }
  set(f);
}

/** An image pasted with Ctrl+V becomes the pending attachment, like a picked file. */
function acceptPasted(file: File, set: (f: File | null) => void) {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    toast.error("Pasted image is larger than 5 MB.");
    return;
  }
  set(file);
  toast.success("Image attached");
}

/**
 * Right-hand pane of the task modal.
 * Chat: simple messages, straight into the stream.
 * Discussion: topics (title + details) with threaded replies.
 * The Chat / Discussion switch sits at the bottom next to the composer.
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
  // chat composer / topic composer
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  // reply composer (discussion)
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [sending, startSend] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const replyFileInput = useRef<HTMLInputElement>(null);
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

  // Chat: keep the newest message in view.
  const count = current.messages.length;
  useEffect(() => {
    const el = listRef.current;
    if (el && kind === "CHAT") el.scrollTop = el.scrollHeight;
  }, [count, kind]);

  function submit(fields: { title?: string; content: string; parentId?: string; file: File | null }, after: () => void) {
    const text = fields.content.trim();
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("kind", kind);
    fd.set("content", text);
    fd.set("mentionIds", JSON.stringify(mentionedIds(text, users)));
    if (fields.title) fd.set("title", fields.title.trim());
    if (fields.parentId) fd.set("parentId", fields.parentId);
    if (fields.file) fd.set("file", fields.file);
    startSend(async () => {
      const result = await postTaskMessage(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const message = result.data;
      setStore((prev) => ({ ...prev, [kind]: { ...prev[kind], messages: [...prev[kind].messages, message] } }));
      after();
    });
  }

  function sendChat() {
    if (!content.trim() && !file) return;
    submit({ content, file }, () => {
      setContent("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
    });
  }

  function startTopic() {
    if (!title.trim()) {
      toast.error("Give the discussion a topic title.");
      return;
    }
    submit({ title, content, file }, () => {
      setTitle("");
      setContent("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      toast.success("Discussion started");
    });
  }

  function sendReply(parentId: string) {
    if (!replyText.trim() && !replyFile) return;
    submit({ content: replyText, parentId, file: replyFile }, () => {
      setReplyText("");
      setReplyFile(null);
      setReplyTo(null);
      if (replyFileInput.current) replyFileInput.current.value = "";
    });
  }

  const messages = current.messages;
  const topLevel = messages.filter((m) => !m.parentId);
  const repliesOf = (id: string) => messages.filter((m) => m.parentId === id);


  function chatBubble(m: TaskMessage) {
    const mine = m.author.id === currentUserId;
    return (
      <div key={m.id} className={cn("flex gap-2", mine && "flex-row-reverse")}>
        <Avatar className="size-7 shrink-0">
          <AvatarFallback className="bg-primary/10 text-[10px] text-primary">{getInitials(m.author.name)}</AvatarFallback>
        </Avatar>
        <div className={cn("flex max-w-[85%] flex-col", mine ? "items-end" : "items-start")}>
          <div className={cn("flex items-center gap-2 text-[11px] text-muted-foreground", mine && "flex-row-reverse")}>
            <span className="font-medium text-foreground">{mine ? "You" : m.author.name}</span>
            <span title={formatDateTime(m.createdAt)}>{timeAgo(m.createdAt)}</span>
          </div>
          <div className={cn("mt-0.5 rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap", mine ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-muted")}>
            {m.content && <span>{renderWithMentions(m.content, users, currentUserId, mine)}</span>}
            {m.attachments.map((f) => (
              <AttachmentChip key={f.id} file={f} mine={mine} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  function topicCard(m: TaskMessage) {
    const replies = repliesOf(m.id);
    const open = replyTo === m.id;
    return (
      <article key={m.id} className="rounded-xl border bg-card p-3">
        <div className="flex items-start gap-2">
          <Avatar className="size-7 shrink-0">
            <AvatarFallback className="bg-primary/10 text-[10px] text-primary">{getInitials(m.author.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug">{m.title || m.content || "Discussion"}</p>
            <p className="text-[11px] text-muted-foreground">
              {m.author.id === currentUserId ? "You" : m.author.name} · <span title={formatDateTime(m.createdAt)}>{timeAgo(m.createdAt)}</span>
              {replies.length > 0 && ` · ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
            </p>
            {m.title && m.content && (
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">{renderWithMentions(m.content, users, currentUserId)}</p>
            )}
            {m.attachments.map((f) => (
              <AttachmentChip key={f.id} file={f} />
            ))}
          </div>
        </div>

        {replies.length > 0 && (
          <ul className="mt-3 space-y-3 border-l-2 pl-3">
            {replies.map((r) => (
              <li key={r.id} className="flex gap-2">
                <Avatar className="size-6 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-[9px] text-primary">{getInitials(r.author.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">{r.author.id === currentUserId ? "You" : r.author.name}</span> ·{" "}
                    <span title={formatDateTime(r.createdAt)}>{timeAgo(r.createdAt)}</span>
                  </p>
                  {r.content && <p className="whitespace-pre-wrap text-sm">{renderWithMentions(r.content, users, currentUserId)}</p>}
                  {r.attachments.map((f) => (
                    <AttachmentChip key={f.id} file={f} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}

        {canPost && (
          <div className="mt-3">
            {open ? (
              <div className="space-y-2 rounded-lg bg-muted/40 p-2">
                {replyFile && (
                  <PendingFile
                    file={replyFile}
                    onClear={() => {
                      setReplyFile(null);
                      if (replyFileInput.current) replyFileInput.current.value = "";
                    }}
                  />
                )}
                <div className="flex items-end gap-2">
                  <input ref={replyFileInput} type="file" className="hidden" onChange={(e) => pickFile(e, setReplyFile)} aria-label="Attach a file to the reply" />
                  <Button type="button" size="icon-sm" variant="outline" aria-label="Attach file" onClick={() => replyFileInput.current?.click()}>
                    <Paperclip />
                  </Button>
                  <MentionComposer value={replyText} onChange={setReplyText} users={users} rows={1} autoFocus placeholder="Write a reply… @ to mention" ariaLabel="Reply" onSubmit={() => sendReply(m.id)} onPasteFile={(f) => acceptPasted(f, setReplyFile)} className="min-w-0 flex-1" />
                  <Button type="button" size="sm" onClick={() => sendReply(m.id)} disabled={sending || (!replyText.trim() && !replyFile)}>
                    {sending ? <Loader2 className="animate-spin" /> : <Send />} Reply
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel reply" onClick={() => setReplyTo(null)}>
                    <X />
                  </Button>
                </div>
              </div>
            ) : (
              <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setReplyTo(m.id)}>
                <CornerDownRight className="size-3" /> Reply
              </button>
            )}
          </div>
        )}
      </article>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {!current.loaded ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        ) : topLevel.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
            {kind === "CHAT" ? <MessageCircle className="size-6" /> : <MessagesSquare className="size-6" />}
            {kind === "CHAT" ? "No messages yet. Start the conversation about this task." : "No discussions on this task yet."}
          </div>
        ) : kind === "CHAT" ? (
          topLevel.map(chatBubble)
        ) : (
          [...topLevel].reverse().map(topicCard)
        )}
      </div>

      <div className="border-t bg-background/80 p-3">
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
                {store[k].loaded && store[k].messages.filter((m) => !m.parentId).length > 0 && (
                  <span className={cn("text-[10px]", kind === k ? "opacity-80" : "text-muted-foreground")}>{store[k].messages.filter((m) => !m.parentId).length}</span>
                )}
              </Button>
            ))}
          </div>
          <span className="hidden text-[11px] text-muted-foreground sm:inline">
            {kind === "CHAT" ? "Quick messages with everyone on this task" : "Start a topic; people reply underneath · paste images with Ctrl+V"}
          </span>
        </div>

        {!canPost ? (
          <p className="text-xs text-muted-foreground">You can read this conversation but not post in it.</p>
        ) : kind === "CHAT" ? (
          <>
            {file && (
              <PendingFile
                file={file}
                onClear={() => {
                  setFile(null);
                  if (fileInput.current) fileInput.current.value = "";
                }}
              />
            )}
            <div className="flex items-end gap-2">
              <input ref={fileInput} type="file" className="hidden" onChange={(e) => pickFile(e, setFile)} aria-label="Attach a file" />
              <Button type="button" size="icon" variant="outline" aria-label="Attach file" title="Attach a file (max 5 MB)" onClick={() => fileInput.current?.click()}>
                <Paperclip />
              </Button>
              <MentionComposer value={content} onChange={setContent} users={users} rows={1} placeholder="Message about this task… @ to mention" ariaLabel="Chat message" onSubmit={sendChat} onPasteFile={(f) => acceptPasted(f, setFile)} className="min-w-0 flex-1" />
              <Button type="button" onClick={sendChat} disabled={sending || (!content.trim() && !file)} aria-label="Send">
                {sending ? <Loader2 className="animate-spin" /> : <Send />} Send
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Ctrl+Enter to send · files up to 5 MB are saved with the task</p>
          </>
        ) : (
          <div className="space-y-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New topic title" maxLength={160} aria-label="New topic title" />
            <MentionComposer value={content} onChange={setContent} users={users} rows={2} placeholder="Details (optional) · @ to mention · paste an image with Ctrl+V" ariaLabel="Discussion details" onSubmit={startTopic} onPasteFile={(f) => acceptPasted(f, setFile)} />
            {file && (
              <PendingFile
                file={file}
                onClear={() => {
                  setFile(null);
                  if (fileInput.current) fileInput.current.value = "";
                }}
              />
            )}
            <div className="flex items-center gap-2">
              <input ref={fileInput} type="file" className="hidden" onChange={(e) => pickFile(e, setFile)} aria-label="Attach a file" />
              <Button type="button" size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
                <Paperclip /> Attach file
              </Button>
              <Button type="button" size="sm" className="ml-auto" onClick={startTopic} disabled={sending || !title.trim()}>
                {sending ? <Loader2 className="animate-spin" /> : <MessagesSquare />} Start discussion
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
