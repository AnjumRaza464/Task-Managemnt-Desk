"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CornerDownRight, Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addComment, deleteComment } from "@/actions/comments";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MentionComposer, mentionedIds, renderWithMentions, type MentionUser } from "@/components/tasks/mention-composer";
import { AttachmentChip } from "@/components/member/task-conversation";
import { AttachButton, FileDropZone, PendingFiles, acceptPasted, mergeFiles } from "@/components/shared/attachment-picker";
import { cn, formatDateTime, getInitials, timeAgo } from "@/lib/utils";

export type CommentNode = {
  id: string;
  title?: string | null;
  content: string;
  createdAt: Date;
  author: { id: string; name: string };
  mentions: { userId: string }[];
  attachments?: { id: string; fileName: string; mimeType: string; size: number }[];
  replies?: CommentNode[];
};

export function CommentSection({
  target,
  comments,
  currentUserId,
  users,
  canComment = true,
  canModerate = false,
  title = "Comments",
  description,
  layout = "composer-top",
}: {
  target: { taskId: string } | { projectId: string };
  comments: CommentNode[];
  currentUserId: string;
  /** People who can be @mentioned. */
  users: MentionUser[];
  canComment?: boolean;
  /** May delete other people's comments. */
  canModerate?: boolean;
  title?: string;
  description?: string;
  /** "composer-bottom": messages above (oldest first, newest at the bottom), typing bar below, like a chat. */
  layout?: "composer-top" | "composer-bottom";
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const addFiles = (incoming: File[]) => setFiles((prev) => mergeFiles(prev, incoming));
  const addReplyFiles = (incoming: File[]) => setReplyFiles((prev) => mergeFiles(prev, incoming));
  const [posting, startPost] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const total = comments.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0);

  function post(text: string, parentId: string | null, attached: File[]) {
    const trimmed = text.trim();
    if (!trimmed && attached.length === 0) return;
    const fd = new FormData();
    if ("taskId" in target) fd.set("taskId", target.taskId);
    else fd.set("projectId", target.projectId);
    if (parentId) fd.set("parentId", parentId);
    fd.set("content", trimmed);
    fd.set("mentionIds", JSON.stringify(mentionedIds(trimmed, users)));
    for (const f of attached) fd.append("file", f);
    startPost(async () => {
      const result = await addComment(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (parentId) {
        setReplyContent("");
        setReplyFiles([]);
        setReplyTo(null);
      } else {
        setContent("");
        setFiles([]);
      }
      toast.success(parentId ? "Reply posted" : "Comment posted");
      router.refresh();
    });
  }

  function remove(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteComment(id);
      setDeletingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function item(c: CommentNode, isReply: boolean) {
    const mine = c.author.id === currentUserId;
    const mentionUsers = users.filter((u) => c.mentions.some((m) => m.userId === u.id) || c.content.includes(`@${u.name}`));
    return (
      <li key={c.id} className={cn("group flex gap-3", isReply && "mt-3")}>
        <Avatar className={isReply ? "size-6" : "size-8"}>
          <AvatarFallback className="bg-primary/10 text-xs text-primary">{getInitials(c.author.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{c.author.name}</span>
            <span title={formatDateTime(c.createdAt)}>{timeAgo(c.createdAt)}</span>
            {mine && <span className="rounded bg-muted px-1 text-[10px]">you</span>}
            <span className="ml-auto flex items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              {canComment && !isReply && (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Reply"
                  title="Reply"
                  onClick={() => {
                    setReplyTo(replyTo === c.id ? null : c.id);
                    setReplyFiles([]);
                  }}
                >
                  <CornerDownRight />
                </Button>
              )}
              {(mine || canModerate) && (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Delete comment"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={deletingId === c.id}
                  onClick={() => remove(c.id)}
                >
                  {deletingId === c.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                </Button>
              )}
            </span>
          </div>
          {c.title && <p className="text-sm font-semibold">{c.title}</p>}
          {c.content && <p className="whitespace-pre-wrap text-sm">{renderWithMentions(c.content, mentionUsers, currentUserId)}</p>}
          {c.attachments?.map((f) => (
            <AttachmentChip key={f.id} file={f} />
          ))}

          {!isReply && (c.replies?.length ?? 0) > 0 && (
            <ul className="mt-2 border-l-2 pl-3">{c.replies!.map((r) => item(r, true))}</ul>
          )}
          {!isReply && replyTo === c.id && (
            <FileDropZone onFiles={addReplyFiles} className="mt-2 space-y-2 border-l-2 pl-3">
              <MentionComposer
                value={replyContent}
                onChange={setReplyContent}
                users={users}
                rows={2}
                autoFocus
                placeholder={`Reply to ${c.author.name}… use @ to mention someone · paste or drop files`}
                ariaLabel="Reply"
                onSubmit={() => post(replyContent, c.id, replyFiles)}
                onPasteFiles={(fs) => acceptPasted(fs, addReplyFiles)}
              />
              <PendingFiles files={replyFiles} onRemove={(i) => setReplyFiles((prev) => prev.filter((_, j) => j !== i))} />
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={posting || (!replyContent.trim() && replyFiles.length === 0)} onClick={() => post(replyContent, c.id, replyFiles)}>
                  {posting ? <Loader2 className="animate-spin" /> : <Send />} Reply
                </Button>
                <AttachButton onFiles={addReplyFiles} disabled={posting} size="icon-sm" variant="ghost" iconOnly label="Attach files to the reply" />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setReplyTo(null);
                    setReplyFiles([]);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </FileDropZone>
          )}
        </div>
      </li>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="size-4 text-muted-foreground" />
          {title} <span className="text-sm font-normal text-muted-foreground">{total}</span>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {layout === "composer-bottom" &&
          (comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet. Start the discussion below.</p>
          ) : (
            <ul className="space-y-4">{[...comments].reverse().map((c) => item(c, false))}</ul>
          ))}

        {canComment && (
          <FileDropZone onFiles={addFiles} className={cn("space-y-2", layout === "composer-bottom" && "border-t pt-4")}>
            <MentionComposer
              value={content}
              onChange={setContent}
              users={users}
              placeholder="Write a comment… type @ to mention someone · paste or drop files to attach"
              ariaLabel="New comment"
              onSubmit={() => post(content, null, files)}
              onPasteFiles={(fs) => acceptPasted(fs, addFiles)}
            />
            <PendingFiles files={files} onRemove={(i) => setFiles((prev) => prev.filter((_, j) => j !== i))} />
            <div className="flex flex-wrap items-center gap-2">
              <AttachButton onFiles={addFiles} disabled={posting} title="Attach files (images show inline · 5 MB per comment)" />
              <span className="text-xs text-muted-foreground">Ctrl+Enter to post · @ to mention · drag files here</span>
              <Button size="sm" className="ml-auto" disabled={posting || (!content.trim() && files.length === 0)} onClick={() => post(content, null, files)}>
                {posting ? <Loader2 className="animate-spin" /> : <Send />} Post
              </Button>
            </div>
          </FileDropZone>
        )}

        {layout === "composer-top" &&
          (comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="space-y-4">{comments.map((c) => item(c, false))}</ul>
          ))}
      </CardContent>
    </Card>
  );
}
