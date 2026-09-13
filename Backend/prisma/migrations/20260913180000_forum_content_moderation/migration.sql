-- CreateEnum
CREATE TYPE "ForumContentStatus" AS ENUM ('PUBLISHED', 'PENDING_REVIEW', 'BLOCKED', 'REMOVED');

-- AlterTable
ALTER TABLE "ForumReply" ADD COLUMN     "moderationContentHash" TEXT,
ADD COLUMN     "moderationPolicyVersion" TEXT,
ADD COLUMN     "moderationReasonCode" TEXT,
ADD COLUMN     "moderationRuleId" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "status" "ForumContentStatus" NOT NULL DEFAULT 'PUBLISHED';

-- AlterTable
ALTER TABLE "ForumThread" ADD COLUMN     "moderationContentHash" TEXT,
ADD COLUMN     "moderationPolicyVersion" TEXT,
ADD COLUMN     "moderationReasonCode" TEXT,
ADD COLUMN     "moderationRuleId" TEXT,
ADD COLUMN     "status" "ForumContentStatus" NOT NULL DEFAULT 'PUBLISHED';

-- Las respuestas existentes ya fueron publicadas y notificadas.
UPDATE "ForumReply" SET "publishedAt" = "createdAt" WHERE "publishedAt" IS NULL;

-- CreateIndex
CREATE INDEX "ForumReply_threadId_status_createdAt_idx" ON "ForumReply"("threadId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ForumThread_subforumId_status_createdAt_idx" ON "ForumThread"("subforumId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ForumThread_barrioId_status_createdAt_idx" ON "ForumThread"("barrioId", "status", "createdAt");
