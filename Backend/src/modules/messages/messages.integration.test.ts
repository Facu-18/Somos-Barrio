import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../app";
import { API, registerAndLogin } from "../../test/helpers";

describe("Mensajes — integration", () => {
  let senderToken: string;
  let receiverId: string;
  let messageId: string;
  let receiverToken: string;

  beforeAll(async () => {
    const sender = await registerAndLogin({ name: "Sender Test" });
    senderToken = sender.token;

    const receiver = await registerAndLogin({ name: "Receiver Test" });
    receiverToken = receiver.token;
    receiverId = receiver.user.id;
  });

  it("GET /messages?type=inbox — lista vacía al inicio", async () => {
    const res = await request(app)
      .get(`${API}/messages?type=inbox`)
      .set("Authorization", `Bearer ${receiverToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it("GET /messages — sin token devuelve 401", async () => {
    const res = await request(app).get(`${API}/messages?type=inbox`);
    expect(res.status).toBe(401);
  });

  it("POST /messages — envía mensaje correctamente", async () => {
    const res = await request(app)
      .post(`${API}/messages`)
      .set("Authorization", `Bearer ${senderToken}`)
      .send({ receiverId, content: "Hola, ¿está disponible el producto?" });

    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe("Hola, ¿está disponible el producto?");
    expect(res.body.data.sender).toBeDefined();
    messageId = res.body.data.id;
  });

  it("POST /messages — no puede enviarse mensaje a sí mismo", async () => {
    const me = await registerAndLogin({ name: "Self Test" });

    const res = await request(app)
      .post(`${API}/messages`)
      .set("Authorization", `Bearer ${me.token}`)
      .send({ receiverId: me.user.id, content: "Me mando un mensaje" });

    expect(res.status).toBe(400);
  });

  it("POST /messages — destinatario inexistente devuelve 404", async () => {
    const res = await request(app)
      .post(`${API}/messages`)
      .set("Authorization", `Bearer ${senderToken}`)
      .send({ receiverId: "cl00000000000000000000000", content: "Hola" });

    expect(res.status).toBe(404);
  });

  it("GET /messages?type=sent — sender ve el mensaje enviado", async () => {
    const res = await request(app)
      .get(`${API}/messages?type=sent`)
      .set("Authorization", `Bearer ${senderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  it("GET /messages?type=inbox — receiver ve el mensaje recibido", async () => {
    const res = await request(app)
      .get(`${API}/messages?type=inbox`)
      .set("Authorization", `Bearer ${receiverToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  it("PATCH /messages/:id/read — receiver marca como leído", async () => {
    const res = await request(app)
      .patch(`${API}/messages/${messageId}/read`)
      .set("Authorization", `Bearer ${receiverToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.readAt).toBeTruthy();
  });

  it("PATCH /messages/:id/read — sender no puede marcar como leído", async () => {
    const res = await request(app)
      .patch(`${API}/messages/${messageId}/read`)
      .set("Authorization", `Bearer ${senderToken}`);

    expect(res.status).toBe(403);
  });
});
