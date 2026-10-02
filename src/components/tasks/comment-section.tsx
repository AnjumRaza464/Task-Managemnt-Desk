"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addComment, deleteComment } from "@/actions/comments";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, getInitials, timeAgo } from "@/lib/utils";

type Comment = { id: string; content: string; createdAt: Date; author: { id: string; name: string } };

export function CommentSection({ taskId, comments, currentUserId }: { taskId: string; comments: Comment[]; currentUserId: string }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [posting, startPost] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function post(event: React.FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;
    startPost(async () => {
      const result = await addComment({ taskId, content });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setContent("");
      toast.success("Comment added");
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Comments <span className="text-sm font-normal text-muted-foreground">{comments.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={post} className="space-y-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write a comment…"
            rows={3}
            maxLength={2000}
            aria-label="New comment"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") post(e);
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Ctrl+Enter to post</span>
            <Button type="submit" size="sm" disabled={posting || !content.trim()}>
              {posting ? <Loader2 className="animate-spin" /> : <Send />} Post
            </Button>
          </div>
        </form>

        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          <ul className="space-y-4">
            {comments.map((c) => (
              <li key={c.id} className="group flex gap-3">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">{getInitials(c.author.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{c.author.name}</span>
                    <span title={formatDateTime(c.createdAt)}>{timeAgo(c.createdAt)}</span>
                    {c.author.id === currentUserId && <span className="rounded bg-muted px-1 text-[10px]">you</span>}
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label="Delete comment"
                      className="ml-auto text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                      disabled={deletingId === c.id}
                      onClick={() => remove(c.id)}
                    >
                      {deletingId === c.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                    </Button>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{c.content}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
