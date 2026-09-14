-- AlterTable
ALTER TABLE "NewsAiGeneration" ADD COLUMN     "cached" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "completionTokens" INTEGER,
ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "estimatedCostUsd" DECIMAL(12,6),
ADD COLUMN     "promptTokens" INTEGER,
ADD COLUMN     "totalTokens" INTEGER;
