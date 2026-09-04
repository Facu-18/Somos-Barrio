ALTER TABLE "NotificationOutbox" ADD COLUMN "deliveredTokens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
