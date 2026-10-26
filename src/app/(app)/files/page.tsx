import type { Metadata } from "next";
import { requireManagerPage } from "@/lib/auth-guard";
import { getSharedFiles } from "@/lib/queries/files";
import { getAssignableUsers } from "@/lib/queries/users";
import { PageHeader } from "@/components/shared/page-header";
import { ShareFileButton } from "@/components/files/share-file-dialog";
import { SharedFilesTable } from "@/components/files/shared-files-table";

export const metadata: Metadata = { title: "Shared files" };

export default async function FilesPage() {
  const manager = await requireManagerPage();
  const [files, users] = await Promise.all([getSharedFiles(), getAssignableUsers()]);
  const targets = users.filter((u) => u.id !== manager.id);

  return (
    <>
      <PageHeader
        title="Shared files"
        description="Documents, PDFs and images shared with the team. Share with everyone, or pick the users who should see a file."
      >
        <ShareFileButton users={targets} />
      </PageHeader>
      <SharedFilesTable files={files} />
    </>
  );
}
