"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Globe, Loader2, Search, Share2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { shareFile } from "@/actions/files";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_SHARED_FILE_BYTES, ROLE_LABELS } from "@/lib/constants";
import { cn, formatBytes } from "@/lib/utils";
import type { Role } from "@/generated/prisma/enums";

export type ShareTarget = { id: string; name: string; email: string; role: Role };

type Audience = "all" | "users";

const AUDIENCES: Array<{ value: Audience; icon: typeof Globe; title: string; description: string }> = [
  { value: "all", icon: Globe, title: "Everyone", description: "Every active user can open it" },
  { value: "users", icon: Users, title: "Specific users", description: "Only the people you pick" },
];

export function ShareFileButton({ users }: { users: ShareTarget[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Share2 /> Share a file
      </Button>
      <ShareFileDialog open={open} onOpenChange={setOpen} users={users} />
    </>
  );
}

export function ShareFileDialog({
  open,
  onOpenChange,
  users,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: ShareTarget[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  // Reset the form each time the dialog opens.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setFile(null);
      setNote("");
      setAudience("all");
      setSelected(new Set());
      setQuery("");
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, query]);
  const allVisibleSelected = visible.length > 0 && visible.every((u) => selected.has(u.id));

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllVisible(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const u of visible) {
        if (checked) next.add(u.id);
        else next.delete(u.id);
      }
      return next;
    });
  }

  function onFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    if (chosen && chosen.size > MAX_SHARED_FILE_BYTES) {
      toast.error("File is larger than 4 MB.");
      event.target.value = "";
      return;
    }
    setFile(chosen);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      toast.error("Choose a file to share.");
      return;
    }
    if (audience === "users" && selected.size === 0) {
      toast.error("Choose at least one user.");
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    formData.set("note", note);
    formData.set("audience", audience);
    for (const id of selected) formData.append("userIds", id);

    startTransition(async () => {
      const result = await shareFile(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        audience === "all"
          ? `Shared ${file.name} with everyone`
          : `Shared ${file.name} with ${selected.size} user${selected.size === 1 ? "" : "s"}`,
      );
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>Share a file</DialogTitle>
            <DialogDescription>
              Send a document, PDF or image to the whole team or to specific users. Recipients are notified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>File</Label>
              <input ref={inputRef} type="file" className="hidden" onChange={onFileChosen} aria-label="Choose a file" />
              {file ? (
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <FileUp className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Remove file"
                    onClick={() => {
                      setFile(null);
                      if (inputRef.current) inputRef.current.value = "";
                    }}
                  >
                    <X />
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
                  <FileUp /> Choose a file (max 4 MB)
                </Button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note">Message (optional)</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Updated brand guidelines, please read before Friday"
                maxLength={500}
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Share with</Label>
              <div className="grid grid-cols-2 gap-2">
                {AUDIENCES.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={audience === o.value}
                    onClick={() => setAudience(o.value)}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent",
                      audience === o.value && "border-primary bg-primary/5",
                    )}
                  >
                    <o.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="block font-medium">{o.title}</span>
                      <span className="block text-xs text-muted-foreground">{o.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {audience === "users" && (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search users…"
                    className="pl-8"
                    aria-label="Search users"
                  />
                </div>
                <label className="flex items-center gap-2 border-b px-1 pb-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(checked) => toggleAllVisible(Boolean(checked))}
                    disabled={visible.length === 0}
                    aria-label="Select all shown users"
                  />
                  Select all shown · {selected.size} selected
                </label>
                <ul className="max-h-52 space-y-0.5 overflow-y-auto">
                  {visible.length === 0 && <li className="px-1 py-2 text-sm text-muted-foreground">No users match.</li>}
                  {visible.map((u) => (
                    <li key={u.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-accent">
                        <Checkbox checked={selected.has(u.id)} onCheckedChange={(checked) => toggle(u.id, Boolean(checked))} />
                        <span className="min-w-0 flex-1 truncate">{u.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{ROLE_LABELS[u.role]}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !file}>
              {pending ? <Loader2 className="animate-spin" /> : <Share2 />}
              {pending ? "Sharing…" : "Share"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
