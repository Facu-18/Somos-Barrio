ALTER TABLE "MarketplaceAsset" DROP CONSTRAINT "MarketplaceAsset_delivery_status_check";

ALTER TABLE "MarketplaceAsset" ADD CONSTRAINT "MarketplaceAsset_delivery_status_check" CHECK (
    ("status" = 'APPROVED' AND "url" IS NOT NULL AND "cloudinaryPublicId" IS NOT NULL AND "cloudinaryType" = 'upload')
    OR ("status" IN ('QUARANTINED', 'PROMOTION_PENDING', 'REJECTION_PENDING') AND "url" IS NULL AND (
        ("cloudinaryPublicId" IS NULL AND "cloudinaryType" IS NULL)
        OR ("cloudinaryPublicId" IS NOT NULL AND "cloudinaryType" = 'authenticated')
    ))
    OR ("status" = 'REJECTED' AND "url" IS NULL AND "cloudinaryPublicId" IS NULL AND "cloudinaryType" IS NULL)
    OR ("status" = 'DELETE_PENDING' AND "postId" IS NULL AND "url" IS NULL)
);

ALTER TABLE "MarketplaceAppeal" ADD COLUMN "postVersion" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "MarketplaceAppeal_one_pending_per_post"
ON "MarketplaceAppeal" ("postId")
WHERE "status" = 'PENDING';

ALTER TABLE "MarketplaceAsset" ADD CONSTRAINT "MarketplaceAsset_barrioId_fkey"
FOREIGN KEY ("barrioId") REFERENCES "Barrio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketplaceReport" ADD CONSTRAINT "MarketplaceReport_resolvedById_fkey"
FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketplaceReport" ADD CONSTRAINT "MarketplaceReport_resolutionDecisionId_fkey"
FOREIGN KEY ("resolutionDecisionId") REFERENCES "MarketplaceModerationDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketplaceAppeal" ADD CONSTRAINT "MarketplaceAppeal_resolvedById_fkey"
FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketplaceAppeal" ADD CONSTRAINT "MarketplaceAppeal_againstDecisionId_fkey"
FOREIGN KEY ("againstDecisionId") REFERENCES "MarketplaceModerationDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketplaceAppeal" ADD CONSTRAINT "MarketplaceAppeal_resolutionDecisionId_fkey"
FOREIGN KEY ("resolutionDecisionId") REFERENCES "MarketplaceModerationDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketplaceModerationDecision" ADD CONSTRAINT "MarketplaceModerationDecision_appealId_fkey"
FOREIGN KEY ("appealId") REFERENCES "MarketplaceAppeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
