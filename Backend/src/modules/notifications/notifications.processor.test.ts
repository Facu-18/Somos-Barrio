import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    notificationOutbox: {
      findMany: vi.fn(),
      updateMany: vi.fn()
    }
  }
}));
vi.mock("../../config/env", () => ({
  env: { NOTIFICATION_BATCH_SIZE: 25, NOTIFICATION_POLL_INTERVAL_MS: 5000 }
}));
vi.mock("../../config/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("./notifications.service", () => {
  class PartialPushDeliveryError extends Error {
    constructor(message: string, readonly deliveredTokens: string[]) {
      super(message);
    }
  }
  return {
    PartialPushDeliveryError,
    notificationsService: { deliver: vi.fn() }
  };
});

import { prisma } from "../../lib/prisma";
import { notificationsService } from "./notifications.service";
import { processNotificationOutbox } from "./notifications.processor";

describe("processNotificationOutbox", () => {
  beforeEach(() => vi.clearAllMocks());

  it("solo completa una entrega si conserva el token de lock", async () => {
    vi.mocked(prisma.notificationOutbox.findMany).mockResolvedValueOnce([{
      id: "outbox-1",
      userId: "user-1",
      title: "Titulo",
      body: "Cuerpo",
      data: {},
      attempts: 0,
      maxAttempts: 5,
      nextAttemptAt: new Date(),
      lockedAt: null,
      lockToken: null,
      deliveredTokens: [],
      processedAt: null,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
    vi.mocked(prisma.notificationOutbox.updateMany)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    vi.mocked(notificationsService.deliver).mockResolvedValueOnce();

    await processNotificationOutbox();

    const claim = vi.mocked(prisma.notificationOutbox.updateMany).mock.calls[0][0];
    const completion = vi.mocked(prisma.notificationOutbox.updateMany).mock.calls[1][0];
    expect(claim.data).toMatchObject({ lockToken: expect.any(String) });
    expect(completion.where).toEqual({ id: "outbox-1", lockToken: claim.data.lockToken });
    expect(completion.data).toMatchObject({ processedAt: expect.any(Date), lockToken: null });
  });

  it("conserva entregas parciales para no duplicarlas durante el reintento", async () => {
    const { PartialPushDeliveryError } = await import("./notifications.service");
    vi.mocked(prisma.notificationOutbox.findMany).mockResolvedValueOnce([{
      id: "outbox-2",
      userId: "user-1",
      title: "Titulo",
      body: "Cuerpo",
      data: {},
      attempts: 0,
      maxAttempts: 5,
      nextAttemptAt: new Date(),
      lockedAt: null,
      lockToken: null,
      deliveredTokens: ["ExpoPushToken[previous_123456]"],
      processedAt: null,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
    vi.mocked(prisma.notificationOutbox.updateMany)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    vi.mocked(notificationsService.deliver).mockRejectedValueOnce(
      new PartialPushDeliveryError("Rate limited", ["ExpoPushToken[ok_123456]"])
    );

    await processNotificationOutbox();

    expect(notificationsService.deliver).toHaveBeenCalledWith(
      "user-1",
      "Titulo",
      "Cuerpo",
      {},
      ["ExpoPushToken[previous_123456]"]
    );
    expect(vi.mocked(prisma.notificationOutbox.updateMany).mock.calls[1][0].data).toMatchObject({
      deliveredTokens: ["ExpoPushToken[previous_123456]", "ExpoPushToken[ok_123456]"],
      processedAt: null
    });
  });
});
