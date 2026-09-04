import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    pushDevice: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn()
    }
  }
}));

vi.mock("../../config/env", () => ({
  env: { NODE_ENV: "test", EXPO_ACCESS_TOKEN: undefined, NOTIFICATION_FETCH_TIMEOUT_MS: 10000 }
}));

import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { notificationsService } from "./notifications.service";

describe("notificationsService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reasigna tokens durante el registro", async () => {
    vi.mocked(prisma.pushDevice.upsert).mockResolvedValue({} as never);
    await notificationsService.registerDevice("user-2", "ExpoPushToken[token_123456]", "ios");
    expect(prisma.pushDevice.upsert).toHaveBeenCalledWith({
      where: { token: "ExpoPushToken[token_123456]" },
      update: { userId: "user-2", platform: "ios" },
      create: { userId: "user-2", token: "ExpoPushToken[token_123456]", platform: "ios" }
    });
  });

  it("desregistra solo tokens del usuario autenticado", async () => {
    vi.mocked(prisma.pushDevice.deleteMany).mockResolvedValue({ count: 0 });
    await notificationsService.unregisterDevice("user-1", "ExpoPushToken[token_123456]");
    expect(prisma.pushDevice.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", token: "ExpoPushToken[token_123456]" }
    });
  });

  it("limpia por token cuando el cliente ya no conserva la sesion anterior", async () => {
    vi.mocked(prisma.pushDevice.deleteMany).mockResolvedValue({ count: 1 });
    await notificationsService.unregisterDeviceByToken("ExpoPushToken[token_123456]");
    expect(prisma.pushDevice.deleteMany).toHaveBeenCalledWith({
      where: { token: "ExpoPushToken[token_123456]" }
    });
  });

  it("nunca llama a Expo durante tests", async () => {
    vi.mocked(prisma.pushDevice.findMany).mockResolvedValue([{
      id: "device-1", userId: "user-1", token: "ExpoPushToken[token_123456]", platform: "android",
      createdAt: new Date(), updatedAt: new Date()
    }]);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await notificationsService.deliver("user-1", "Titulo", "Cuerpo", {});
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("elimina tokens que Expo marca como no registrados", async () => {
    vi.mocked(prisma.pushDevice.findMany).mockResolvedValue([{
      id: "device-1", userId: "user-1", token: "ExpoPushToken[expired_123456]", platform: "android",
      createdAt: new Date(), updatedAt: new Date()
    }]);
    vi.mocked(prisma.pushDevice.deleteMany).mockResolvedValue({ count: 1 });
    (env as { NODE_ENV: string }).NODE_ENV = "development";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      data: [{ status: "error", details: { error: "DeviceNotRegistered" } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    try {
      await notificationsService.deliver("user-1", "Titulo", "Cuerpo", {});
      expect(prisma.pushDevice.deleteMany).toHaveBeenCalledWith({
        where: { token: { in: ["ExpoPushToken[expired_123456]"] } }
      });
    } finally {
      (env as { NODE_ENV: string }).NODE_ENV = "test";
      fetchSpy.mockRestore();
    }
  });

  it("no reintenta dispositivos exitosos por errores permanentes en tickets mixtos", async () => {
    vi.mocked(prisma.pushDevice.findMany).mockResolvedValue([
      { id: "1", userId: "user-1", token: "ExpoPushToken[ok_123456]", platform: "android", createdAt: new Date(), updatedAt: new Date() },
      { id: "2", userId: "user-1", token: "ExpoPushToken[large_123456]", platform: "android", createdAt: new Date(), updatedAt: new Date() }
    ]);
    (env as { NODE_ENV: string }).NODE_ENV = "development";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [
      { status: "ok", id: "ticket-1" },
      { status: "error", message: "Message too big", details: { error: "MessageTooBig" } }
    ] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    try {
      await expect(notificationsService.deliver("user-1", "Titulo", "Cuerpo", {})).resolves.toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      (env as { NODE_ENV: string }).NODE_ENV = "test";
      fetchSpy.mockRestore();
    }
  });

  it("reintenta a nivel outbox cuando falla toda la solicitud", async () => {
    vi.mocked(prisma.pushDevice.findMany).mockResolvedValue([{
      id: "1", userId: "user-1", token: "ExpoPushToken[token_123456]", platform: "android", createdAt: new Date(), updatedAt: new Date()
    }]);
    (env as { NODE_ENV: string }).NODE_ENV = "development";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 503 }));
    try {
      await expect(notificationsService.deliver("user-1", "Titulo", "Cuerpo", {})).rejects.toThrow("503");
    } finally {
      (env as { NODE_ENV: string }).NODE_ENV = "test";
      fetchSpy.mockRestore();
    }
  });

  it("expone los dispositivos ya entregados cuando un ticket debe reintentarse", async () => {
    vi.mocked(prisma.pushDevice.findMany).mockResolvedValue([
      { id: "1", userId: "user-1", token: "ExpoPushToken[ok_123456]", platform: "android", createdAt: new Date(), updatedAt: new Date() },
      { id: "2", userId: "user-1", token: "ExpoPushToken[retry_123456]", platform: "android", createdAt: new Date(), updatedAt: new Date() }
    ]);
    (env as { NODE_ENV: string }).NODE_ENV = "development";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [
      { status: "ok", id: "ticket-1" },
      { status: "error", message: "Rate limited", details: { error: "MessageRateExceeded" } }
    ] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    try {
      await expect(notificationsService.deliver("user-1", "Titulo", "Cuerpo", {})).rejects.toMatchObject({
        deliveredTokens: ["ExpoPushToken[ok_123456]"]
      });
    } finally {
      (env as { NODE_ENV: string }).NODE_ENV = "test";
      fetchSpy.mockRestore();
    }
  });

  it("excluye dispositivos entregados en intentos anteriores", async () => {
    vi.mocked(prisma.pushDevice.findMany).mockResolvedValue([]);
    await notificationsService.deliver("user-1", "Titulo", "Cuerpo", {}, ["ExpoPushToken[ok_123456]"]);
    expect(prisma.pushDevice.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", token: { notIn: ["ExpoPushToken[ok_123456]"] } }
    });
  });
});
