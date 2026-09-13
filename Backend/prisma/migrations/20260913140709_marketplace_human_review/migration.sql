/*
  Warnings:

  - A unique constraint covering the columns `[idempotencyKey]` on the table `MarketplaceModerationDecision` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[postId,toVersion]` on the table `MarketplaceModerationDecision` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "MarketplaceModerationAction" AS ENUM ('AUTO_REVIEW', 'REPORT_THRESHOLD', 'APPROVE', 'REJECT', 'REMOVE', 'RESTORE', 'OWNER_RESUBMIT', 'APPEAL_ACCEPT', 'APPEAL_REJECT');

-- CreateEnum
CREATE TYPE "MarketplaceReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "MarketplaceAppealStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "MarketplaceAssetModerationAction" AS ENUM ('APPROVE', 'REJECT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MarketplaceAssetStatus" ADD VALUE 'PROMOTION_PENDING';
ALTER TYPE "MarketplaceAssetStatus" ADD VALUE 'REJECTION_PENDING';

-- DropIndex
DROP INDEX "MarketplaceModerationDecision_postId_idx";

-- DropIndex
DROP INDEX "MarketplacePost_barrioId_availability_moderationStatus_crea_idx";

-- AlterTable
ALTER TABLE "MarketplaceAsset" ADD COLUMN     "barrioId" TEXT,
ADD COLUMN     "moderationVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "MarketplaceModerationDecision" ADD COLUMN     "action" "MarketplaceModerationAction",
ADD COLUMN     "appealId" TEXT,
ADD COLUMN     "evidence" JSONB,
ADD COLUMN     "fromStatus" "ModerationStatus",
ADD COLUMN     "fromVersion" INTEGER,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "reasonCode" TEXT,
ADD COLUMN     "toVersion" INTEGER;

-- AlterTable
ALTER TABLE "MarketplacePost" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "moderationVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "MarketplaceReport" ADD COLUMN     "resolutionDecisionId" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedById" TEXT,
ADD COLUMN     "status" "MarketplaceReportStatus" NOT NULL DEFAULT 'OPEN';

-- CreateTable
CREATE TABLE "MarketplaceAppeal" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "againstDecisionId" TEXT,
    "statement" TEXT NOT NULL,
    "status" "MarketplaceAppealStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "resolutionDecisionId" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceAssetModerationDecision" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "moderatorId" TEXT,
    "action" "MarketplaceAssetModerationAction" NOT NULL,
    "reasonCode" TEXT,
    "privateNote" TEXT,
    "fromStatus" "MarketplaceAssetStatus",
    "toStatus" "MarketplaceAssetStatus",
    "fromVersion" INTEGER,
    "toVersion" INTEGER,
    "idempotencyKey" TEXT NOT NULL,
    "policyVersion" TEXT,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceAssetModerationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceAppeal_idempotencyKey_key" ON "MarketplaceAppeal"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MarketplaceAppeal_postId_idx" ON "MarketplaceAppeal"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceAssetModerationDecision_idempotencyKey_key" ON "MarketplaceAssetModerationDecision"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MarketplaceAssetModerationDecision_assetId_createdAt_idx" ON "MarketplaceAssetModerationDecision"("assetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceAssetModerationDecision_assetId_toVersion_key" ON "MarketplaceAssetModerationDecision"("assetId", "toVersion");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceModerationDecision_idempotencyKey_key" ON "MarketplaceModerationDecision"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MarketplaceModerationDecision_postId_createdAt_idx" ON "MarketplaceModerationDecision"("postId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceModerationDecision_postId_toVersion_key" ON "MarketplaceModerationDecision"("postId", "toVersion");

-- CreateIndex
CREATE INDEX "MarketplacePost_barrioId_deletedAt_moderationStatus_updated_idx" ON "MarketplacePost"("barrioId", "deletedAt", "moderationStatus", "updatedAt");

-- AddForeignKey
ALTER TABLE "MarketplaceAppeal" ADD CONSTRAINT "MarketplaceAppeal_postId_fkey" FOREIGN KEY ("postId") REFERENCES "MarketplacePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceAppeal" ADD CONSTRAINT "MarketplaceAppeal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceAssetModerationDecision" ADD CONSTRAINT "MarketplaceAssetModerationDecision_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MarketplaceAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceAssetModerationDecision" ADD CONSTRAINT "MarketplaceAssetModerationDecision_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
