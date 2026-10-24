-- AlterTable
ALTER TABLE "ChatMessage" ALTER COLUMN "recipientId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "teamChatReadAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ChatMessage_recipientId_createdAt_idx" ON "ChatMessage"("recipientId", "createdAt");
