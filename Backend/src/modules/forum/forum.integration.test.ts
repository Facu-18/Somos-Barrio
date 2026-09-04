import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../../app";
import { API, registerAndLogin, seedBarrio } from "../../test/helpers";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env["DATABASE_URL"] } },
});

describe("Foro — integration", () => {
  let barrioSlug: string;
  let barrioId: string;
  let subforumSlug: string;
  let threadId: string;
  let userToken: string;
  let otherToken: string;
  let thirdToken: string;
  let crossBarrioToken: string;
  let firstReplyId: string;

  beforeAll(async () => {
    const barrio = await seedBarrio(`forum-barrio-${Date.now()}`);
    barrioSlug = barrio.slug;
    barrioId   = barrio.id;

    // Crear subforo directamente
    const subforum = await prisma.forumSubforum.create({
      data: { name: "General", slug: `general-${Date.now()}`, barrioId },
    });
    subforumSlug = subforum.slug;

    const u1 = await registerAndLogin({ name: "Forista", barrioSlug });
    userToken  = u1.token;
    const u2 = await registerAndLogin({ name: "Otro", barrioSlug });
    otherToken = u2.token;
    thirdToken = (await registerAndLogin({ name: "Tercero", barrioSlug })).token;
    const otherBarrio = await seedBarrio(`forum-other-${Date.now()}`);
    crossBarrioToken = (await registerAndLogin({ name: "Forista Externo", barrioSlug: otherBarrio.slug })).token;
  });

  it("GET /barrios/:slug/forum — lista subforos", async () => {
    const res = await request(app).get(`${API}/barrios/${barrioSlug}/forum`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("POST /:subforumSlug/threads — usuario puede crear hilo", async () => {
    const res = await request(app)
      .post(`${API}/barrios/${barrioSlug}/forum/${subforumSlug}/threads`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ title: "Hilo de prueba", content: "Contenido del hilo de prueba para test." });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe("Hilo de prueba");
    threadId = res.body.data.id;
  });

  it("GET /:subforumSlug/threads — lista hilos del subforo (paginada)", async () => {
    const res = await request(app).get(
      `${API}/barrios/${barrioSlug}/forum/${subforumSlug}/threads`
    );
    expect(res.status).toBe(200);
    // La respuesta tiene { data: { items: [...], total, page, limit } }
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  it("GET /:subforumSlug/threads/:threadId — obtiene hilo con respuestas", async () => {
    const res = await request(app).get(
      `${API}/barrios/${barrioSlug}/forum/${subforumSlug}/threads/${threadId}`
    );
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(threadId);
    expect(Array.isArray(res.body.data.replies)).toBe(true);
    expect(res.body.data.user).not.toHaveProperty("name");
    expect(res.body.data.user).not.toHaveProperty("avatarPublicId");
  });

  it("POST /:subforumSlug/threads/:threadId/replies — puede responder", async () => {
    const res = await request(app)
      .post(`${API}/barrios/${barrioSlug}/forum/${subforumSlug}/threads/${threadId}/replies`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ content: "Respuesta de prueba al hilo." });

    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe("Respuesta de prueba al hilo.");
    firstReplyId = res.body.data.id;
  });

  it("encola avisos al padre inmediato y autor del hilo con deep link completo", async () => {
    const before = await prisma.notificationOutbox.count();
    const res = await request(app)
      .post(`${API}/barrios/${barrioSlug}/forum/${subforumSlug}/threads/${threadId}/replies`)
      .set("Authorization", `Bearer ${thirdToken}`)
      .send({ content: "Respuesta anidada.", parentReplyId: firstReplyId });

    expect(res.status).toBe(201);
    const rows = await prisma.notificationOutbox.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 5000) } },
      orderBy: { createdAt: "desc" },
      take: 2
    });
    expect(await prisma.notificationOutbox.count()).toBe(before + 2);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.data).toMatchObject({ barrioSlug, subforumSlug, threadId, replyId: res.body.data.id });
    }
  });

  it("rechaza respuestas de usuarios de otro barrio", async () => {
    const before = await prisma.notificationOutbox.count();
    const res = await request(app)
      .post(`${API}/barrios/${barrioSlug}/forum/${subforumSlug}/threads/${threadId}/replies`)
      .set("Authorization", `Bearer ${crossBarrioToken}`)
      .send({ content: "No deberia publicarse." });
    expect(res.status).toBe(403);
    expect(await prisma.notificationOutbox.count()).toBe(before);
  });

  it("POST /:subforumSlug/threads/:threadId/vote — voto toggle upvote", async () => {
    const res = await request(app)
      .post(`${API}/barrios/${barrioSlug}/forum/${subforumSlug}/threads/${threadId}/vote`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ value: 1 });

    expect(res.status).toBe(200);
    // El servicio devuelve { voted: bool, value: 1|-1|null }
    expect(typeof res.body.data.voted).toBe("boolean");
  });

  it("DELETE /:subforumSlug/threads/:threadId — autor puede borrar", async () => {
    const res = await request(app)
      .delete(`${API}/barrios/${barrioSlug}/forum/${subforumSlug}/threads/${threadId}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(204);
  });
});
