import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { prisma } from "../../lib/prisma";
import { notificationsService, PartialPushDeliveryError } from "./notifications.service";
import { randomUUID } from "crypto";

const LOCK_TIMEOUT_MS = 5 * 60 * 1000;
let timer: NodeJS.Timeout | undefined;
let processing = false;

export async function processNotificationOutbox(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    const now = new Date();
    const staleLock = new Date(now.getTime() - LOCK_TIMEOUT_MS);
    const candidates = await prisma.notificationOutbox.findMany({
      where: {
        processedAt: null,
        nextAttemptAt: { lte: now },
        OR: [{ lockedAt: null }, { lockedAt: { lt: staleLock } }]
      },
      orderBy: { createdAt: "asc" },
      take: env.NOTIFICATION_BATCH_SIZE
    });

    for (const candidate of candidates) {
      const lockToken = randomUUID();
      const claimed = await prisma.notificationOutbox.updateMany({
        where: {
          id: candidate.id,
          processedAt: null,
          nextAttemptAt: { lte: now },
          OR: [{ lockedAt: null }, { lockedAt: { lt: staleLock } }]
        },
        data: { lockedAt: now, lockToken }
      });
      if (claimed.count === 0) continue;

      try {
        await notificationsService.deliver(candidate.userId, candidate.title, candidate.body, candidate.data, candidate.deliveredTokens);
        await prisma.notificationOutbox.updateMany({
          where: { id: candidate.id, lockToken },
          data: { attempts: { increment: 1 }, processedAt: new Date(), lockedAt: null, lockToken: null, lastError: null }
        });
      } catch (error) {
        const attempts = candidate.attempts + 1;
        const exhausted = attempts >= candidate.maxAttempts;
        const retryDelay = Math.min(60 * 60 * 1000, 2 ** attempts * 1000);
        const deliveredTokens = error instanceof PartialPushDeliveryError
          ? [...new Set([...candidate.deliveredTokens, ...error.deliveredTokens])]
          : candidate.deliveredTokens;
        await prisma.notificationOutbox.updateMany({
          where: { id: candidate.id, lockToken },
          data: {
            attempts,
            lockedAt: null,
            lockToken: null,
            processedAt: exhausted ? new Date() : null,
            nextAttemptAt: new Date(Date.now() + retryDelay),
            deliveredTokens,
            lastError: error instanceof Error ? error.message.slice(0, 1000) : "Error desconocido"
          }
        });
        logger.warn({ err: error, outboxId: candidate.id, attempts }, "Fallo enviando notificacion push");
      }
    }
  } finally {
    processing = false;
  }
}

export function startNotificationProcessor(): void {
  if (timer) return;
  void processNotificationOutbox().catch((error) => logger.error({ err: error }, "Fallo procesando outbox"));
  timer = setInterval(() => {
    void processNotificationOutbox().catch((error) => logger.error({ err: error }, "Fallo procesando outbox"));
  }, env.NOTIFICATION_POLL_INTERVAL_MS);
  timer.unref();
}

export async function stopNotificationProcessor(): Promise<void> {
  if (timer) clearInterval(timer);
  timer = undefined;
  while (processing) await new Promise((resolve) => setTimeout(resolve, 10));
}
