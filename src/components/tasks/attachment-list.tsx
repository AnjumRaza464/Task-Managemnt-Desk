"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { deleteAttachment, uploadAttachment } from "@/actions/attachments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MAX_ATTACHMENT_BYTES } from "@/lib/constants";
import { formatBytes, formatDate } from "@/lib/utils";

type Attachment = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  uploadedBy: { name: string };
};

export function AttachmentList({ taskId, attachments }: { taskId: string; attachments: Attachment[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function onFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("File is larger than 5 MB.");
      event.target.value = "";
      return;
    }
    const formData = new FormData();
    formData.set("taskId", taskId);
    formData.set("file", file);
    startUpload(async () => {
      const result = await uploadAttachment(formData);
      if (inputRef.current) inputRef.current.value = "";
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Uploaded ${file.name}`);
      router.refresh();
    });
  }

  function remove(attachment: Attachment) {
    setDeletingId(attachment.id);
    startTransition(async () => {
      const result = await deleteAttachment(attachment.id);
      setDeletingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Attachment removed");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Attachments <span className="text-sm font-normal text-muted-foreground">{attachments.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <input ref={inputRef} type="file" className="hidden" onChange={onFileChosen} aria-label="Choose a file" />
        <Button variant="outline" size="sm" className="w-full" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />} {uploading ? "Uploading…" : "Upload file (max 5 MB)"}
        </Button>

        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attachments.</p>
        ) : (
          <ul className="divide-y">
            {attachments.map((a) => (
              <li key={a.id} className="group flex items-center gap-2 py-2 text-sm">
                {a.mimeType.startsWith("image/") ? (
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <a href={`/api/attachments/${a.id}`} className="block truncate hover:underline" download>
                    {a.fileName}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(a.size)} · {a.uploadedBy.name} · {formatDate(a.createdAt)}
                  </p>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Download"
                  nativeButton={false}
                  render={<a href={`/api/attachments/${a.id}`} download />}
                >
                  <Download />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Delete attachment"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={deletingId === a.id}
                  onClick={() => remove(a)}
                >
                  {deletingId === a.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
