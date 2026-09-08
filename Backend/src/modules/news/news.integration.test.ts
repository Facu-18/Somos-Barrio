import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { app } from "../../app";
import { API, registerAndLogin, seedBarrio } from "../../test/helpers";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env["DATABASE_URL"] } },
});

describe("Noticias — integration", () => {
  let barrioSlug: string;
  let editorToken: string;
  let vecinoToken: string;
  let newsSlug: string;
  let draftSlug: string;
  let observerId: string;

  beforeAll(async () => {
    const barrio = await seedBarrio(`news-barrio-${Date.now()}`);
    barrioSlug = barrio.slug;

    // Crear editor directamente en DB
    const editorEmail = `editor_${Date.now()}@test.com`;
    await prisma.user.create({
      data: {
        email: editorEmail,
        name: "Editor Test",
        passwordHash: await bcrypt.hash("Editor123!", 10),
        role: UserRole.EDITOR,
        barrioId: barrio.id,
      },
    });
    const edRes = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: editorEmail, password: "Editor123!" });
    editorToken = edRes.body.data?.accessToken;

    const vecinoRes = await registerAndLogin({ name: "Vecino News", barrioSlug });
    vecinoToken = vecinoRes.token;
    const observerRes = await registerAndLogin({ name: "Observador News", barrioSlug });
    observerId = observerRes.user.id;
    const otherBarrio = await seedBarrio(`news-other-${Date.now()}`);
    await registerAndLogin({ name: "Otro Barrio", barrioSlug: otherBarrio.slug });
  });

  it("GET /barrios/:slug/news — lista noticias (paginada)", async () => {
    const res = await request(app).get(`${API}/barrios/${barrioSlug}/news`);
    expect(res.status).toBe(200);
    // Estructura: { data: { items: [], total, page, limit } }
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it("POST /barrios/:slug/news — EDITOR puede crear noticia", async () => {
    const slug = `test-noticia-${Date.now()}`;
    const res = await request(app)
      .post(`${API}/barrios/${barrioSlug}/news`)
      .set("Authorization", `Bearer ${editorToken}`)
      .send({
        title: "Noticia de prueba",
        slug,
        content: "Contenido de la noticia de prueba con suficiente texto.",
        category: "COMUNIDAD",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe(slug);
    expect(res.body.data.status).toBe("DRAFT");
    draftSlug = slug;
  });

  it("POST /barrios/:slug/news — VECINO puede enviar una propuesta a revisión", async () => {
    const slug = `propuesta-vecino-${Date.now()}`;
    const res = await request(app)
      .post(`${API}/barrios/${barrioSlug}/news`)
      .set("Authorization", `Bearer ${vecinoToken}`)
      .send({
        title: "Intento vecino",
        slug,
        content: "Contenido intento.",
        category: "COMUNIDAD",
        status: "PENDING_REVIEW",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("PENDING_REVIEW");
    newsSlug = slug;
  });

  it("GET /barrios/:slug/news/mine — devuelve las propuestas del autor", async () => {
    const res = await request(app)
      .get(`${API}/barrios/${barrioSlug}/news/mine`)
      .set("Authorization", `Bearer ${vecinoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual(expect.arrayContaining([expect.objectContaining({ slug: newsSlug })]));
  });

  it("GET /barrios/:slug/news/manage/:newsSlug — permite previsualizar al autor", async () => {
    const res = await request(app)
      .get(`${API}/barrios/${barrioSlug}/news/manage/${newsSlug}`)
      .set("Authorization", `Bearer ${vecinoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PENDING_REVIEW");
  });

  it("PATCH /barrios/:slug/news/:newsSlug — no permite publicar fuera del flujo editorial", async () => {
    const res = await request(app)
      .patch(`${API}/barrios/${barrioSlug}/news/${draftSlug}`)
      .set("Authorization", `Bearer ${editorToken}`)
      .send({ status: "PUBLISHED" });

    expect(res.status).toBe(400);
  });

  it("GET /editorial/pending y POST /approve — publican una propuesta una sola vez", async () => {
    const pending = await request(app)
      .get(`${API}/barrios/${barrioSlug}/news/editorial/pending`)
      .set("Authorization", `Bearer ${editorToken}`);
    expect(pending.status).toBe(200);
    expect(pending.body.data.items).toEqual(expect.arrayContaining([expect.objectContaining({ slug: newsSlug })]));

    const res = await request(app)
      .post(`${API}/barrios/${barrioSlug}/news/${newsSlug}/approve`)
      .set("Authorization", `Bearer ${editorToken}`)
      .send({
        excerpt: "Descripción revisada por el editor.",
        content: "Contenido revisado de la noticia con suficiente información.",
        aiSummary: {
          summary: "Resumen revisado.",
          provider: "OpenAI-Compatible",
          model: "test-model",
          generatedAt: new Date().toISOString(),
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PUBLISHED");
    expect(res.body.data.aiSummary.summary).toBe("Resumen revisado.");
    const notifications = await prisma.notificationOutbox.findMany({ where: { data: { path: ["newsSlug"], equals: newsSlug } } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].userId).toBe(observerId);
    expect(notifications[0].data).toMatchObject({ barrioSlug, newsSlug });

    const duplicate = await request(app)
      .post(`${API}/barrios/${barrioSlug}/news/${newsSlug}/approve`)
      .set("Authorization", `Bearer ${editorToken}`)
      .send({});
    expect(duplicate.status).toBe(404);
    expect(await prisma.notificationOutbox.count({ where: { data: { path: ["newsSlug"], equals: newsSlug } } })).toBe(1);
  });

  it("GET /barrios/:slug/news/:newsSlug — devuelve noticia publicada", async () => {
    const res = await request(app).get(`${API}/barrios/${barrioSlug}/news/${newsSlug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe(newsSlug);
    expect(res.body.data.author).not.toHaveProperty("name");
    expect(res.body.data.author).not.toHaveProperty("avatarPublicId");
  });

  it("DELETE /barrios/:slug/news/:newsSlug — EDITOR puede borrar su noticia", async () => {
    const res = await request(app)
      .delete(`${API}/barrios/${barrioSlug}/news/${newsSlug}`)
      .set("Authorization", `Bearer ${editorToken}`);

    expect(res.status).toBe(204);
  });

  it("GET /barrios/inexistente/news — 404 para barrio inexistente", async () => {
    const res = await request(app).get(`${API}/barrios/barrio-no-existe/news`);
    expect(res.status).toBe(404);
  });
});
