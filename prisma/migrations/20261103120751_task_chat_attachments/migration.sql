-- CreateEnum
CREATE TYPE "CommentKind" AS ENUM ('DISCUSSION', 'CHAT');

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "commentId" TEXT;

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "kind" "CommentKind" NOT NULL DEFAULT 'DISCUSSION';

-- CreateIndex
CREATE INDEX "Attachment_commentId_idx" ON "Attachment"("commentId");

-- CreateIndex
CREATE INDEX "Comment_taskId_kind_createdAt_idx" ON "Comment"("taskId", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
