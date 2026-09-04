import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../app";
import { API, registerAndLogin, testPrisma } from "../../test/helpers";
import { processNotificationOutbox } from "./notifications.processor";

describe("Notificaciones — integration", () => {
  let firstToken: string;
  let secondToken: string;
  let secondUserId: string;
  let firstUserId: string;
  const expoToken = "ExpoPushToken[test_device_123456789]";

  beforeAll(async () => {
    const first = await registerAndLogin({ name: "Dispositivo Uno" });
    firstToken = first.token;
    firstUserId = first.user.id;
    const second = await registerAndLogin({ name: "Dispositivo Dos" });
    secondToken = second.token;
    secondUserId = second.user.id;
  });

  it("valida y registra un token Expo", async () => {
    const invalid = await request(app)
      .post(`${API}/notifications/register`)
      .set("Authorization", `Bearer ${firstToken}`)
      .send({ token: "raw-fcm-token", platform: "android" });
    expect(invalid.status).toBe(400);

    const registered = await request(app)
      .post(`${API}/notifications/register`)
      .set("Authorization", `Bearer ${firstToken}`)
      .send({ token: expoToken, platform: "android" });
    expect(registered.status).toBe(200);
  });

  it("reasigna el token al usuario actual y solo su dueño puede eliminarlo", async () => {
    await request(app)
      .post(`${API}/notifications/register`)
      .set("Authorization", `Bearer ${secondToken}`)
      .send({ token: expoToken, platform: "ios" })
      .expect(200);

    await request(app)
      .delete(`${API}/notifications/register`)
      .set("Authorization", `Bearer ${firstToken}`)
      .send({ token: expoToken })
      .expect(204);
    expect(await testPrisma.pushDevice.findUnique({ where: { token: expoToken } })).toMatchObject({ userId: secondUserId, platform: "ios" });

    await request(app)
      .delete(`${API}/notifications/register`)
      .set("Authorization", `Bearer ${secondToken}`)
      .send({ token: expoToken })
      .expect(204);
    expect(await testPrisma.pushDevice.findUnique({ where: { token: expoToken } })).toBeNull();
  });

  it("permite limpiar un token retenido sin conservar credenciales de la cuenta anterior", async () => {
    await testPrisma.pushDevice.create({
      data: { userId: firstUserId, token: expoToken, platform: "android" }
    });

    await request(app)
      .post(`${API}/notifications/unregister`)
      .send({ token: expoToken })
      .expect(204);

    expect(await testPrisma.pushDevice.findUnique({ where: { token: expoToken } })).toBeNull();
  });

  it("procesa el outbox sin hacer llamadas externas en NODE_ENV=test", async () => {
    const row = await testPrisma.notificationOutbox.create({
      data: { userId: firstUserId, title: "Prueba", body: "Cuerpo", data: { type: "test" } }
    });
    await processNotificationOutbox();
    const processed = await testPrisma.notificationOutbox.findUniqueOrThrow({ where: { id: row.id } });
    expect(processed.processedAt).not.toBeNull();
    expect(processed.attempts).toBe(1);
    expect(processed.lastError).toBeNull();
  });
});
