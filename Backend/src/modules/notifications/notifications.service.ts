import { Prisma } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type OutboxNotification = {
  userId: string;
  title: string;
  body: string;
  data: Record<string, string>;
};

type ExpoTicket = {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
};

export class PartialPushDeliveryError extends Error {
  constructor(message: string, readonly deliveredTokens: string[]) {
    super(message);
    this.name = "PartialPushDeliveryError";
  }
}

export const notificationsService = {
  registerDevice(userId: string, token: string, platform: string) {
    return prisma.pushDevice.upsert({
      where: { token },
      update: { userId, platform },
      create: { userId, token, platform }
    });
  },

  async unregisterDevice(userId: string, token: string): Promise<void> {
    await prisma.pushDevice.deleteMany({ where: { userId, token } });
  },

  async unregisterDeviceByToken(token: string): Promise<void> {
    await prisma.pushDevice.deleteMany({ where: { token } });
  },

  async enqueue(transaction: Prisma.TransactionClient, notifications: OutboxNotification[]): Promise<void> {
    if (notifications.length === 0) return;
    await transaction.notificationOutbox.createMany({
      data: notifications.map((notification) => ({
        ...notification,
        data: notification.data as Prisma.InputJsonObject
      }))
    });
  },

  async deliver(userId: string, title: string, body: string, data: Prisma.JsonValue, deliveredTokens: string[] = []): Promise<void> {
    const devices = await prisma.pushDevice.findMany({
      where: { userId, ...(deliveredTokens.length > 0 ? { token: { notIn: deliveredTokens } } : {}) }
    });
    if (devices.length === 0 || env.NODE_ENV === "test") return;

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {})
      },
      signal: AbortSignal.timeout(env.NOTIFICATION_FETCH_TIMEOUT_MS),
      body: JSON.stringify(devices.map((device) => ({
        to: device.token,
        title,
        body,
        data,
        sound: "default",
        priority: "high",
        channelId: "default"
      })))
    });

    if (!response.ok) throw new Error(`Expo Push Service respondio ${response.status}`);

    const payload = await response.json() as { data?: ExpoTicket[] };
    const tickets = payload.data;
    if (!Array.isArray(tickets) || tickets.length !== devices.length) {
      throw new Error("Respuesta invalida de Expo Push Service");
    }

    const terminalTokens: string[] = [];
    const invalidTokens: string[] = [];
    const transientErrors: string[] = [];
    tickets.forEach((ticket, index) => {
      const token = devices[index].token;
      if (ticket.status !== "error") {
        terminalTokens.push(token);
        return;
      }
      const code = ticket.details?.error;
      if (code === "DeviceNotRegistered") invalidTokens.push(token);
      if (["MessageRateExceeded", "InvalidCredentials", "MismatchSenderId"].includes(code ?? "") || !code) {
        transientErrors.push(ticket.message ?? code ?? "Error transitorio de Expo Push Service");
      } else {
        terminalTokens.push(token);
      }
    });

    if (invalidTokens.length > 0) {
      await prisma.pushDevice.deleteMany({ where: { token: { in: invalidTokens } } });
    }
    if (transientErrors.length > 0) {
      throw new PartialPushDeliveryError(transientErrors.join("; "), terminalTokens);
    }
  }
};
