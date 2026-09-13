CREATE TYPE "MarketplaceAssetStatus" AS ENUM ('QUARANTINED', 'APPROVED', 'REJECTED', 'DELETE_PENDING');

ALTER TABLE "MarketplacePost" ADD COLUMN "legacyImages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "MarketplaceAsset" (
    "id" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "postId" TEXT,
    "status" "MarketplaceAssetStatus" NOT NULL DEFAULT 'QUARANTINED',
    "provider" TEXT NOT NULL DEFAULT 'sightengine',
    "providerRequestId" TEXT,
    "scores" JSONB,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "cloudinaryPublicId" TEXT,
    "cloudinaryType" TEXT,
    "url" TEXT,
    "ocrDecision" TEXT,
    "ocrCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "ocrRuleId" TEXT,
    "ocrRuleVersion" TEXT,
    "ocrPolicyVersion" TEXT,
    "ocrContentHash" TEXT,
    "scannedAt" TIMESTAMP(3),
    "deletionRequestedAt" TIMESTAMP(3),
    "deletionAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketplaceAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceAsset_cloudinaryPublicId_key" ON "MarketplaceAsset"("cloudinaryPublicId");
CREATE INDEX "MarketplaceAsset_uploaderId_createdAt_idx" ON "MarketplaceAsset"("uploaderId", "createdAt");
CREATE INDEX "MarketplaceAsset_postId_idx" ON "MarketplaceAsset"("postId");
CREATE INDEX "MarketplaceAsset_postId_status_idx" ON "MarketplaceAsset"("postId", "status");
CREATE INDEX "MarketplaceAsset_deletionRequestedAt_idx" ON "MarketplaceAsset"("deletionRequestedAt");

ALTER TABLE "MarketplaceAsset" ADD CONSTRAINT "MarketplaceAsset_uploaderId_fkey"
FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceAsset" ADD CONSTRAINT "MarketplaceAsset_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "MarketplacePost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketplaceAsset" ADD CONSTRAINT "MarketplaceAsset_delivery_status_check" CHECK (
    ("status" = 'APPROVED' AND "url" IS NOT NULL AND "cloudinaryPublicId" IS NOT NULL AND "cloudinaryType" = 'upload')
    OR ("status" = 'QUARANTINED' AND "url" IS NULL AND (
        ("cloudinaryPublicId" IS NULL AND "cloudinaryType" IS NULL)
        OR ("cloudinaryPublicId" IS NOT NULL AND "cloudinaryType" = 'authenticated')
    ))
    OR ("status" = 'REJECTED' AND "url" IS NULL AND "cloudinaryPublicId" IS NULL AND "cloudinaryType" IS NULL)
    OR ("status" = 'DELETE_PENDING' AND "postId" IS NULL AND "url" IS NULL)
);

-- Legacy URLs have no verifiable owner or moderation decision. Preserve them only
-- for internal review and return affected posts to review without creating assets.
INSERT INTO "MarketplaceModerationDecision" (
    "id", "postId", "status", "reason", "ruleId", "ruleVersion", "policyVersion",
    "domain", "severity", "categories"
)
SELECT
    'legacy_asset_' || md5(post."id"), post."id", 'PENDING_REVIEW',
    'Legacy image requires verified asset upload', 'LEGACY_IMAGE_REVIEW', 'marketplace-assets-1',
    'marketplace-assets-1', 'MARKETPLACE', 'MEDIUM', ARRAY['LEGACY_IMAGE_REVIEW']::TEXT[]
FROM "MarketplacePost" post
WHERE cardinality(post."images") > 0;

UPDATE "MarketplacePost"
SET "legacyImages" = "images",
    "images" = ARRAY[]::TEXT[],
    "moderationStatus" = 'PENDING_REVIEW',
    "moderationReasonCode" = 'LEGACY_IMAGE_REVIEW'
WHERE cardinality("images") > 0;
