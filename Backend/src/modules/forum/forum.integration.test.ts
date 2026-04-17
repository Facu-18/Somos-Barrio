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

  beforeAll(async () => {
    const barrio = await seedBarrio(`forum-barrio-${Date.now()}`);
    barrioSlug = barrio.slug;
    barrioId   = barrio.id;

    // Crear subforo directamente
    const subforum = await prisma.forumSubforum.create({
      data: { name: "General", slug: `general-${Date.now()}`, barrioId },
    });
    subforumSlug = subforum.slug;

    const u1 = await registerAndLogin({ name: "Forista" });
    userToken  = u1.token;
    const u2 = await registerAndLogin({ name: "Otro" });
    otherToken = u2.token;
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
  });

  it("POST /:subforumSlug/threads/:threadId/replies — puede responder", async () => {
    const res = await request(app)
      .post(`${API}/barrios/${barrioSlug}/forum/${subforumSlug}/threads/${threadId}/replies`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ content: "Respuesta de prueba al hilo." });

    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe("Respuesta de prueba al hilo.");
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
