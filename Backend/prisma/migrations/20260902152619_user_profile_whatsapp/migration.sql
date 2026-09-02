-- AlterTable
ALTER TABLE "MarketplacePost" ADD COLUMN     "whatsapp" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarPublicId" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "nickname" TEXT;
