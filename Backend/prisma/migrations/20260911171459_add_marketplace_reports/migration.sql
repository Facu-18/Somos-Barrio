-- CreateEnum
CREATE TYPE "MarketplaceReportCategory" AS ENUM ('FRAUD', 'SPAM', 'INAPPROPRIATE', 'WEAPONS', 'DRUGS', 'OTHER');

-- AlterTable
ALTER TABLE "MarketplaceModerationDecision" ADD COLUMN     "privateNote" TEXT;

-- CreateTable
CREATE TABLE "MarketplaceReport" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "category" "MarketplaceReportCategory" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketplaceReport_postId_createdAt_idx" ON "MarketplaceReport"("postId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceReport_postId_reporterId_key" ON "MarketplaceReport"("postId", "reporterId");

-- AddForeignKey
ALTER TABLE "MarketplaceReport" ADD CONSTRAINT "MarketplaceReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "MarketplacePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceReport" ADD CONSTRAINT "MarketplaceReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
