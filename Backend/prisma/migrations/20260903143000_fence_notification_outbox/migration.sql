ALTER TABLE "NotificationOutbox" ADD COLUMN "lockToken" TEXT;
CREATE UNIQUE INDEX "NotificationOutbox_lockToken_key" ON "NotificationOutbox"("lockToken");
