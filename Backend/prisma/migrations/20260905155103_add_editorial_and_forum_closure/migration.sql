-- AlterTable
ALTER TABLE "ForumThread" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "isClosed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "News" ADD COLUMN     "editorObservation" TEXT;
