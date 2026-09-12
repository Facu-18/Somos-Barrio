ALTER TABLE "MarketplacePost"
ADD COLUMN "moderationReasonCode" TEXT;

ALTER TABLE "MarketplaceModerationDecision"
ADD COLUMN "ruleVersion" TEXT,
ADD COLUMN "domain" TEXT,
ADD COLUMN "severity" TEXT,
ADD COLUMN "contentHash" TEXT,
ADD COLUMN "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Every pre-existing publication receives an explicit, append-only baseline decision.
INSERT INTO "MarketplaceModerationDecision" (
  "id",
  "postId",
  "status",
  "reason",
  "ruleId",
  "ruleVersion",
  "policyVersion",
  "domain",
  "severity",
  "categories"
)
SELECT
  'legacy_' || md5(post."id"),
  post."id",
  post."moderationStatus",
  'Existing publication backfill',
  'LEGACY_BACKFILL',
  'legacy-1',
  'legacy-1',
  'MARKETPLACE',
  CASE WHEN post."moderationStatus" = 'APPROVED' THEN 'NONE' ELSE 'MEDIUM' END,
  ARRAY[]::TEXT[]
FROM "MarketplacePost" post
WHERE NOT EXISTS (
  SELECT 1
  FROM "MarketplaceModerationDecision" decision
  WHERE decision."postId" = post."id"
);
