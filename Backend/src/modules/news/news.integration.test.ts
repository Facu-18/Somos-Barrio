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
      },
    });
    const edRes = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: editorEmail, password: "Editor123!" });
    editorToken = edRes.body.data?.accessToken;

    const vecinoRes = await registerAndLogin({ name: "Vecino News" });
    vecinoToken = vecinoRes.token;
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
    newsSlug = slug;
  });

  it("POST /barrios/:slug/news — VECINO no puede crear noticia (403)", async () => {
    const res = await request(app)
      .post(`${API}/barrios/${barrioSlug}/news`)
      .set("Authorization", `Bearer ${vecinoToken}`)
      .send({
        title: "Intento vecino",
        slug: `intento-${Date.now()}`,
        content: "Contenido intento.",
        category: "COMUNIDAD",
      });

    expect(res.status).toBe(403);
  });

  it("PATCH /barrios/:slug/news/:newsSlug — EDITOR puede publicar noticia", async () => {
    const res = await request(app)
      .patch(`${API}/barrios/${barrioSlug}/news/${newsSlug}`)
      .set("Authorization", `Bearer ${editorToken}`)
      .send({ status: "PUBLISHED" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PUBLISHED");
    expect(res.body.data.publishedAt).toBeTruthy();
  });

  it("GET /barrios/:slug/news/:newsSlug — devuelve noticia publicada", async () => {
    const res = await request(app).get(`${API}/barrios/${barrioSlug}/news/${newsSlug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe(newsSlug);
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
