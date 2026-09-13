-- CreateEnum
CREATE TYPE "ForumModerationAction" AS ENUM ('AUTO_REVIEW', 'OWNER_EDIT', 'OWNER_DELETE', 'REPORT_THRESHOLD', 'APPROVE', 'BLOCK', 'REMOVE', 'RESTORE', 'DISMISS_REPORTS', 'APPEAL_ACCEPT', 'APPEAL_REJECT');

-- CreateEnum
CREATE TYPE "ForumReportCategory" AS ENUM ('THREAT', 'HARASSMENT', 'DISCRIMINATION', 'SPAM', 'OTHER');

-- CreateEnum
CREATE TYPE "ForumReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ForumAppealStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED');

-- AlterTable
ALTER TABLE "ForumReply" ADD COLUMN     "moderationVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ForumThread" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "moderationVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ForumModerationDecision" (
    "id" TEXT NOT NULL,
    "threadId" TEXT,
    "replyId" TEXT,
    "barrioId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "ForumModerationAction" NOT NULL,
    "fromStatus" "ForumContentStatus",
    "toStatus" "ForumContentStatus" NOT NULL,
    "fromVersion" INTEGER,
    "toVersion" INTEGER NOT NULL,
    "reasonCode" TEXT,
    "privateNote" TEXT,
    "ruleId" TEXT,
    "overriddenRuleId" TEXT,
    "policyVersion" TEXT,
    "contentHash" TEXT,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "idempotencyKey" TEXT,
    "evidence" JSONB,
    "appealId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumModerationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumReport" (
    "id" TEXT NOT NULL,
    "threadId" TEXT,
    "replyId" TEXT,
    "reporterId" TEXT NOT NULL,
    "category" "ForumReportCategory" NOT NULL,
    "comment" TEXT,
    "status" "ForumReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionDecisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumAppeal" (
    "id" TEXT NOT NULL,
    "threadId" TEXT,
    "replyId" TEXT,
    "ownerId" TEXT NOT NULL,
    "againstDecisionId" TEXT,
    "statement" TEXT NOT NULL,
    "status" "ForumAppealStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "resolutionDecisionId" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ForumModerationDecision_idempotencyKey_key" ON "ForumModerationDecision"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ForumModerationDecision_barrioId_createdAt_idx" ON "ForumModerationDecision"("barrioId", "createdAt");

-- CreateIndex
CREATE INDEX "ForumModerationDecision_overriddenRuleId_idx" ON "ForumModerationDecision"("overriddenRuleId");

-- CreateIndex
CREATE UNIQUE INDEX "ForumModerationDecision_threadId_toVersion_key" ON "ForumModerationDecision"("threadId", "toVersion");

-- CreateIndex
CREATE UNIQUE INDEX "ForumModerationDecision_replyId_toVersion_key" ON "ForumModerationDecision"("replyId", "toVersion");

-- CreateIndex
CREATE INDEX "ForumReport_status_createdAt_idx" ON "ForumReport"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ForumReport_threadId_reporterId_key" ON "ForumReport"("threadId", "reporterId");

-- CreateIndex
CREATE UNIQUE INDEX "ForumReport_replyId_reporterId_key" ON "ForumReport"("replyId", "reporterId");

-- CreateIndex
CREATE UNIQUE INDEX "ForumAppeal_idempotencyKey_key" ON "ForumAppeal"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ForumAppeal_threadId_idx" ON "ForumAppeal"("threadId");

-- CreateIndex
CREATE INDEX "ForumAppeal_replyId_idx" ON "ForumAppeal"("replyId");

-- AddForeignKey
ALTER TABLE "ForumModerationDecision" ADD CONSTRAINT "ForumModerationDecision_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ForumThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumModerationDecision" ADD CONSTRAINT "ForumModerationDecision_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "ForumReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumModerationDecision" ADD CONSTRAINT "ForumModerationDecision_barrioId_fkey" FOREIGN KEY ("barrioId") REFERENCES "Barrio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumModerationDecision" ADD CONSTRAINT "ForumModerationDecision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumModerationDecision" ADD CONSTRAINT "ForumModerationDecision_appealId_fkey" FOREIGN KEY ("appealId") REFERENCES "ForumAppeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ForumThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "ForumReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_resolutionDecisionId_fkey" FOREIGN KEY ("resolutionDecisionId") REFERENCES "ForumModerationDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumAppeal" ADD CONSTRAINT "ForumAppeal_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ForumThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumAppeal" ADD CONSTRAINT "ForumAppeal_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "ForumReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumAppeal" ADD CONSTRAINT "ForumAppeal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumAppeal" ADD CONSTRAINT "ForumAppeal_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumAppeal" ADD CONSTRAINT "ForumAppeal_againstDecisionId_fkey" FOREIGN KEY ("againstDecisionId") REFERENCES "ForumModerationDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumAppeal" ADD CONSTRAINT "ForumAppeal_resolutionDecisionId_fkey" FOREIGN KEY ("resolutionDecisionId") REFERENCES "ForumModerationDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Cada fila apunta exactamente a un hilo o a una respuesta.
ALTER TABLE "ForumModerationDecision" ADD CONSTRAINT "ForumModerationDecision_single_target_check"
CHECK (("threadId" IS NULL) <> ("replyId" IS NULL));

ALTER TABLE "ForumReport" ADD CONSTRAINT "ForumReport_single_target_check"
CHECK (("threadId" IS NULL) <> ("replyId" IS NULL));

ALTER TABLE "ForumAppeal" ADD CONSTRAINT "ForumAppeal_single_target_check"
CHECK (("threadId" IS NULL) <> ("replyId" IS NULL));

-- Una sola apelación pendiente por contenido.
CREATE UNIQUE INDEX "ForumAppeal_one_pending_per_thread" ON "ForumAppeal" ("threadId") WHERE "status" = 'PENDING' AND "threadId" IS NOT NULL;
CREATE UNIQUE INDEX "ForumAppeal_one_pending_per_reply" ON "ForumAppeal" ("replyId") WHERE "status" = 'PENDING' AND "replyId" IS NOT NULL;

-- Historial append-only: solo se admite que las FK opcionales pasen a NULL por ON DELETE SET NULL.
CREATE FUNCTION "forum_moderation_decision_append_only"() RETURNS trigger AS $$
BEGIN
  IF (NEW."actorId" IS DISTINCT FROM OLD."actorId" AND NEW."actorId" IS NOT NULL)
    OR (NEW."appealId" IS DISTINCT FROM OLD."appealId" AND NEW."appealId" IS NOT NULL)
    OR (to_jsonb(NEW) - 'actorId' - 'appealId') IS DISTINCT FROM (to_jsonb(OLD) - 'actorId' - 'appealId') THEN
    RAISE EXCEPTION 'ForumModerationDecision es append-only';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ForumModerationDecision_append_only"
BEFORE UPDATE ON "ForumModerationDecision"
FOR EACH ROW EXECUTE FUNCTION "forum_moderation_decision_append_only"();
