-- CreateEnum
CREATE TYPE "NewsAiOperation" AS ENUM ('SUMMARIZE', 'IMPROVE', 'ASSIST');

-- CreateTable
CREATE TABLE "NewsAiGeneration" (
    "id" TEXT NOT NULL,
    "newsId" TEXT,
    "barrioId" TEXT NOT NULL,
    "requestedById" TEXT,
    "operation" "NewsAiOperation" NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "finishReason" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "output" JSONB NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "appliedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsAiGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewsAiGeneration_newsId_createdAt_idx" ON "NewsAiGeneration"("newsId", "createdAt");

-- AddForeignKey
ALTER TABLE "NewsAiGeneration" ADD CONSTRAINT "NewsAiGeneration_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "News"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsAiGeneration" ADD CONSTRAINT "NewsAiGeneration_barrioId_fkey" FOREIGN KEY ("barrioId") REFERENCES "Barrio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsAiGeneration" ADD CONSTRAINT "NewsAiGeneration_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsAiGeneration" ADD CONSTRAINT "NewsAiGeneration_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
