"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, FolderOpen, Globe, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { deleteSharedFile } from "@/actions/files";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { FileTypeIcon } from "@/components/files/file-icon";
import { formatBytes, formatDate } from "@/lib/utils";
import type { SharedFileRow } from "@/lib/queries/files";

function names(list: Array<{ user: { name: string } }>) {
  return list.map((r) => r.user.name).join(", ");
}

export function SharedFilesTable({ files }: { files: SharedFileRow[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<SharedFileRow | null>(null);

  if (files.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No files shared yet"
        description="Share a document, PDF or image with everyone or with specific users. It will appear here and in their Files page."
      />
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead className="hidden md:table-cell">Shared by</TableHead>
              <TableHead>Shared with</TableHead>
              <TableHead className="hidden sm:table-cell">Opened</TableHead>
              <TableHead className="hidden lg:table-cell">Date</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((f) => {
              const opened = f.recipients.filter((r) => r.viewedAt);
              return (
                <TableRow key={f.id}>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      <FileTypeIcon mimeType={f.mimeType} fileName={f.fileName} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <a
                          href={`/api/files/${f.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="block max-w-xs truncate font-medium hover:underline"
                          title={f.fileName}
                        >
                          {f.fileName}
                        </a>
                        {f.note && <p className="max-w-xs truncate text-xs text-muted-foreground" title={f.note}>{f.note}</p>}
                        <p className="text-xs text-muted-foreground">{formatBytes(f.size)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{f.sharedBy.name}</TableCell>
                  <TableCell>
                    {f.isPublic ? (
                      <Badge variant="outline" className="gap-1 font-medium">
                        <Globe className="size-3" /> Everyone
                      </Badge>
                    ) : (
                      <div>
                        <Badge variant="outline" className="gap-1 font-medium" title={names(f.recipients)}>
                          <Users className="size-3" /> {f.recipients.length} {f.recipients.length === 1 ? "user" : "users"}
                        </Badge>
                        <p className="mt-0.5 max-w-48 truncate text-xs text-muted-foreground" title={names(f.recipients)}>
                          {names(f.recipients)}
                        </p>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell" title={opened.length ? names(opened) : undefined}>
                    {f.isPublic ? (
                      <span>{opened.length} {opened.length === 1 ? "person" : "people"}</span>
                    ) : (
                      <span>
                        {opened.length} of {f.recipients.length}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{formatDate(f.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Open"
                        nativeButton={false}
                        render={<a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" />}
                      >
                        <ExternalLink />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Download"
                        nativeButton={false}
                        render={<a href={`/api/files/${f.id}?download=1`} download />}
                      >
                        <Download />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Remove file"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setTarget(f)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        title="Remove this file?"
        description={
          target ? (
            <>
              <span className="font-medium text-foreground">{target.fileName}</span> will no longer be available to anyone it was
              shared with.
            </>
          ) : undefined
        }
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!target) return;
          const result = await deleteSharedFile(target.id);
          if (!result.ok) throw new Error(result.error);
          toast.success("File removed");
          router.refresh();
        }}
      />
    </>
  );
}
