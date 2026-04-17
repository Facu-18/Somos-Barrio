-- CreateTable
CREATE TABLE "ForumVote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT,
    "replyId" TEXT,
    "value" INTEGER NOT NULL,

    CONSTRAINT "ForumVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ForumVote_threadId_idx" ON "ForumVote"("threadId");

-- CreateIndex
CREATE INDEX "ForumVote_replyId_idx" ON "ForumVote"("replyId");

-- CreateIndex
CREATE UNIQUE INDEX "ForumVote_userId_threadId_key" ON "ForumVote"("userId", "threadId");

-- CreateIndex
CREATE UNIQUE INDEX "ForumVote_userId_replyId_key" ON "ForumVote"("userId", "replyId");

-- AddForeignKey
ALTER TABLE "ForumVote" ADD CONSTRAINT "ForumVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumVote" ADD CONSTRAINT "ForumVote_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ForumThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumVote" ADD CONSTRAINT "ForumVote_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "ForumReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;
