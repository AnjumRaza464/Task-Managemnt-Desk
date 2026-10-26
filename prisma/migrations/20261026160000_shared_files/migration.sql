-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'FILE_SHARED';

-- CreateTable
CREATE TABLE "SharedFile" (
    "id" TEXT NOT NULL,
    "sharedById" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "note" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedFileRecipient" (
    "fileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3),

    CONSTRAINT "SharedFileRecipient_pkey" PRIMARY KEY ("fileId","userId")
);

-- CreateIndex
CREATE INDEX "SharedFile_sharedById_createdAt_idx" ON "SharedFile"("sharedById", "createdAt");

-- CreateIndex
CREATE INDEX "SharedFile_isPublic_createdAt_idx" ON "SharedFile"("isPublic", "createdAt");

-- CreateIndex
CREATE INDEX "SharedFileRecipient_userId_idx" ON "SharedFileRecipient"("userId");

-- AddForeignKey
ALTER TABLE "SharedFile" ADD CONSTRAINT "SharedFile_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedFileRecipient" ADD CONSTRAINT "SharedFileRecipient_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "SharedFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedFileRecipient" ADD CONSTRAINT "SharedFileRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
