"use client";

import { useRef, useState } from "react";
import { ImageIcon, Paperclip, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MAX_ATTACHMENT_BYTES } from "@/lib/constants";
import { cn, formatBytes } from "@/lib/utils";

export const MAX_FILES_PER_MESSAGE = 10;

/** Picked, dropped or pasted files waiting to be sent, each removable. */
export function PendingFiles({ files, onRemove, className }: { files: File[]; onRemove: (index: number) => void; className?: string }) {
  if (files.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {files.map((file, i) => (
        <div key={`${file.name}-${file.size}-${i}`} className="flex max-w-full items-center gap-1.5 rounded-lg border bg-muted/40 px-2 py-1 text-xs">
          {file.type.startsWith("image/") ? <ImageIcon className="size-3.5 shrink-0" /> : <Paperclip className="size-3.5 shrink-0" />}
          <span className="truncate">{file.name}</span>
          <span className="shrink-0 text-muted-foreground">{formatBytes(file.size)}</span>
          <button type="button" className="ml-1 shrink-0" aria-label={`Remove ${file.name}`} onClick={() => onRemove(i)}>
            <X className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Adds picked, dropped or pasted files to the pending list. One message may
 * carry up to 10 files and 5 MB in total (the server-action body limit), each
 * under 5 MB. With `perFile`, every file is sent in its own request, so only
 * the per-file limit applies.
 */
export function mergeFiles(current: File[], incoming: File[], { perFile = false, max = MAX_FILES_PER_MESSAGE } = {}): File[] {
  const next = [...current];
  for (const f of incoming) {
    if (f.size > MAX_ATTACHMENT_BYTES) {
      toast.error(`"${f.name}" is larger than 5 MB.`);
      continue;
    }
    if (next.length >= max) {
      toast.error(`Up to ${max} files at a time.`);
      break;
    }
    if (!perFile && next.reduce((n, x) => n + x.size, 0) + f.size > MAX_ATTACHMENT_BYTES) {
      toast.error("All files of one message together must stay under 5 MB.");
      break;
    }
    next.push(f);
  }
  return next;
}

export function pickFiles(e: React.ChangeEvent<HTMLInputElement>, add: (files: File[]) => void) {
  const list = Array.from(e.target.files ?? []);
  e.target.value = "";
  if (list.length) add(list);
}

/** Images pasted with Ctrl+V become pending attachments, like picked files. */
export function acceptPasted(files: File[], add: (files: File[]) => void) {
  add(files);
  toast.success(files.length === 1 ? "Image attached" : `${files.length} images attached`);
}

/** The files in a drag-and-drop (folders and plain text drags are ignored). */
function droppedFiles(data: DataTransfer): File[] {
  return Array.from(data.files ?? []).filter((f) => f.size > 0 || f.type);
}

function hasFiles(data: DataTransfer | null): boolean {
  return Boolean(data && Array.from(data.types).includes("Files"));
}

/**
 * Lets people drop files from their computer anywhere over its children: an
 * overlay says "Drop files to attach" while a file is dragged over the area,
 * and `onFiles` receives the dropped files.
 */
export function FileDropZone({
  onFiles,
  disabled = false,
  label = "Drop files to attach",
  className,
  overlayClassName,
  children,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  overlayClassName?: string;
  children: React.ReactNode;
}) {
  // dragenter/dragleave fire for every child element; a counter tells when the pointer has really left.
  const depth = useRef(0);
  const [over, setOver] = useState(false);

  return (
    <div
      className={cn("relative", className)}
      onDragEnter={(e) => {
        if (disabled || !hasFiles(e.dataTransfer)) return;
        e.preventDefault();
        depth.current += 1;
        setOver(true);
      }}
      onDragOver={(e) => {
        if (disabled || !hasFiles(e.dataTransfer)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(e) => {
        if (disabled || !hasFiles(e.dataTransfer)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={(e) => {
        if (disabled || !hasFiles(e.dataTransfer)) return;
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        const files = droppedFiles(e.dataTransfer);
        if (files.length) onFiles(files);
      }}
    >
      {children}
      {over && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10 text-sm font-medium text-primary backdrop-blur-[1px]",
            overlayClassName,
          )}
        >
          <span className="flex items-center gap-2 rounded-md bg-background/90 px-3 py-1.5 shadow-sm">
            <Upload className="size-4" /> {label}
          </span>
        </div>
      )}
    </div>
  );
}

/** A hidden file input plus the button that opens it. */
export function AttachButton({
  onFiles,
  disabled,
  size = "sm",
  variant = "outline",
  iconOnly = false,
  label = "Attach files",
  title,
  className,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  size?: "sm" | "icon" | "icon-sm";
  variant?: "outline" | "ghost";
  iconOnly?: boolean;
  label?: string;
  title?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={input} type="file" multiple className="hidden" onChange={(e) => pickFiles(e, onFiles)} aria-label={label} />
      <Button type="button" size={size} variant={variant} aria-label={label} title={title ?? label} disabled={disabled} className={className} onClick={() => input.current?.click()}>
        <Paperclip />
        {!iconOnly && label}
      </Button>
    </>
  );
}
