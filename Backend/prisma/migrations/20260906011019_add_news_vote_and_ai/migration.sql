-- CreateEnum
CREATE TYPE "NewsVoteValue" AS ENUM ('CONFIRM', 'DISPUTE', 'UNSURE');

-- AlterTable
ALTER TABLE "News" ADD COLUMN     "aiSummary" JSONB,
ADD COLUMN     "confirmVotes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "disputeVotes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unsureVotes" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "NewsVote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newsId" TEXT NOT NULL,
    "value" "NewsVoteValue" NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewsVote_newsId_idx" ON "NewsVote"("newsId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsVote_userId_newsId_key" ON "NewsVote"("userId", "newsId");

-- AddForeignKey
ALTER TABLE "NewsVote" ADD CONSTRAINT "NewsVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsVote" ADD CONSTRAINT "NewsVote_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "News"("id") ON DELETE CASCADE ON UPDATE CASCADE;
