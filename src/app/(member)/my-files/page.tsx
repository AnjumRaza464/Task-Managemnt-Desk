import type { Metadata } from "next";
import { Download, ExternalLink, FolderOpen, Globe, UserCheck } from "lucide-react";
import { requireMemberPage } from "@/lib/auth-guard";
import { getFilesForUser } from "@/lib/queries/files";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { FileTypeIcon } from "@/components/files/file-icon";
import { cn, formatBytes, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Shared files" };

export default async function MyFilesPage() {
  const user = await requireMemberPage();
  const files = await getFilesForUser(user.id);
  const unseen = files.filter((f) => !f.viewedAt).length;

  return (
    <>
      <PageHeader
        title="Shared files"
        description={
          unseen > 0
            ? `${unseen} new · documents, PDFs and images your manager has shared with you`
            : "Documents, PDFs and images your manager has shared with you"
        }
      />

      {files.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No files yet"
          description="Files your manager shares with you, or with the whole team, will show up here."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((f) => (
            <li key={f.id}>
              <Card className={cn("h-full", !f.viewedAt && "border-primary/40")}>
                <CardContent className="flex h-full flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <FileTypeIcon mimeType={f.mimeType} fileName={f.fileName} className="size-5 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <a
                          href={`/api/files/${f.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 truncate font-medium hover:underline"
                          title={f.fileName}
                        >
                          {f.fileName}
                        </a>
                        {!f.viewedAt && (
                          <Badge className="shrink-0 bg-primary text-primary-foreground">New</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {f.sharedBy.name} · {formatDate(f.createdAt)} · {formatBytes(f.size)}
                      </p>
                    </div>
                  </div>

                  {f.note && <p className="text-sm text-muted-foreground">{f.note}</p>}

                  <div className="mt-auto flex items-center gap-2 pt-1">
                    <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
                      {f.isPublic ? (
                        <>
                          <Globe className="size-3" /> Everyone
                        </>
                      ) : (
                        <>
                          <UserCheck className="size-3" /> Shared with you
                        </>
                      )}
                    </Badge>
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={<a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" />}
                      >
                        <ExternalLink /> Open
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
