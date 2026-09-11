/*
  Warnings:

  - You are about to drop the column `status` on the `MarketplacePost` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "MarketplaceAvailability" AS ENUM ('AVAILABLE', 'SOLD', 'PAUSED');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REMOVED');

-- DropIndex
DROP INDEX "MarketplacePost_barrioId_status_createdAt_idx";

-- AlterTable
ALTER TABLE "MarketplacePost" DROP COLUMN "status",
ADD COLUMN     "availability" "MarketplaceAvailability" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING_REVIEW';

-- DropEnum
DROP TYPE "MarketplaceStatus";

-- CreateTable
CREATE TABLE "MarketplaceModerationDecision" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "moderatorId" TEXT,
    "status" "ModerationStatus" NOT NULL,
    "reason" TEXT,
    "ruleId" TEXT,
    "policyVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceModerationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketplaceModerationDecision_postId_idx" ON "MarketplaceModerationDecision"("postId");

-- CreateIndex
CREATE INDEX "MarketplacePost_barrioId_availability_moderationStatus_crea_idx" ON "MarketplacePost"("barrioId", "availability", "moderationStatus", "createdAt");

-- AddForeignKey
ALTER TABLE "MarketplaceModerationDecision" ADD CONSTRAINT "MarketplaceModerationDecision_postId_fkey" FOREIGN KEY ("postId") REFERENCES "MarketplacePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceModerationDecision" ADD CONSTRAINT "MarketplaceModerationDecision_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
