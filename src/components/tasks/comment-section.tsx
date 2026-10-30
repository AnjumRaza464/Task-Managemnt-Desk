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
import { cn, formatDateTime, getInitials, timeAgo } from "@/lib/utils";

export type CommentNode = {
  id: string;
  content: string;
  createdAt: Date;
  author: { id: string; name: string };
  mentions: { userId: string }[];
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
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [posting, startPost] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const total = comments.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0);

  function post(text: string, parentId: string | null) {
    const trimmed = text.trim();
    if (!trimmed) return;
    startPost(async () => {
      const result = await addComment({ ...target, parentId: parentId ?? undefined, content: trimmed, mentionIds: mentionedIds(trimmed, users) });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (parentId) {
        setReplyContent("");
        setReplyTo(null);
      } else {
        setContent("");
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
                <Button size="icon-xs" variant="ghost" aria-label="Reply" title="Reply" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>
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
          <p className="whitespace-pre-wrap text-sm">{renderWithMentions(c.content, mentionUsers, currentUserId)}</p>

          {!isReply && (c.replies?.length ?? 0) > 0 && (
            <ul className="mt-2 border-l-2 pl-3">{c.replies!.map((r) => item(r, true))}</ul>
          )}
          {!isReply && replyTo === c.id && (
            <div className="mt-2 space-y-2 border-l-2 pl-3">
              <MentionComposer
                value={replyContent}
                onChange={setReplyContent}
                users={users}
                rows={2}
                autoFocus
                placeholder={`Reply to ${c.author.name}… use @ to mention someone`}
                ariaLabel="Reply"
                onSubmit={() => post(replyContent, c.id)}
              />
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={posting || !replyContent.trim()} onClick={() => post(replyContent, c.id)}>
                  {posting ? <Loader2 className="animate-spin" /> : <Send />} Reply
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>
                  Cancel
                </Button>
              </div>
            </div>
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
        {canComment && (
          <div className="space-y-2">
            <MentionComposer
              value={content}
              onChange={setContent}
              users={users}
              placeholder="Write a comment… type @ to mention someone"
              ariaLabel="New comment"
              onSubmit={() => post(content, null)}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Ctrl+Enter to post · @ to mention</span>
              <Button size="sm" disabled={posting || !content.trim()} onClick={() => post(content, null)}>
                {posting ? <Loader2 className="animate-spin" /> : <Send />} Post
              </Button>
            </div>
          </div>
        )}

        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          <ul className="space-y-4">{comments.map((c) => item(c, false))}</ul>
        )}
      </CardContent>
    </Card>
  );
}
