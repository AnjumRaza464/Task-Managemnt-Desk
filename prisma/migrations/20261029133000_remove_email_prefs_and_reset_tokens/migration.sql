-- DropForeignKey
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_userId_fkey";

-- DropTable
DROP TABLE "PasswordResetToken";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "emailNotifications";
