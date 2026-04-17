import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { app } from "../../app";
import { API, seedBarrio } from "../../test/helpers";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env["DATABASE_URL"] } },
});

describe("Search — integration", () => {
  let barrioSlug: string;
  let barrioId: string;

  beforeAll(async () => {
    const barrio = await seedBarrio(`search-barrio-${Date.now()}`);
    barrioSlug = barrio.slug;
    barrioId   = barrio.id;

    const editorEmail = `editor_search_${Date.now()}@test.com`;
    const hash = await bcrypt.hash("Editor123!", 10);
    const editor = await prisma.user.create({
      data: { email: editorEmail, name: "Editor Search", passwordHash: hash, role: UserRole.EDITOR },
    });

    // Crear noticia publicada para búsqueda
    await prisma.news.create({
      data: {
        title: "Busqueda avanzada prueba",
        slug: `busqueda-avanzada-${Date.now()}`,
        content: "Contenido para probar la busqueda del sistema integrado.",
        category: "COMUNIDAD",
        status: "PUBLISHED",
        publishedAt: new Date(),
        authorId: editor.id,
        barrioId,
      },
    });
  });

  it("GET /search sin q — devuelve 400 (validación)", async () => {
    const res = await request(app).get(`${API}/search`);
    // q es requerido y min 2 chars → error de validación 400
    expect(res.status).toBe(400);
  });

  it("GET /search?q=busqueda — devuelve resultados", async () => {
    const res = await request(app)
      .get(`${API}/search`)
      .query({ q: "busqueda", barrioSlug });

    expect(res.status).toBe(200);
    // Estructura: { success: true, data: { q, results: { news: [...] } } }
    expect(res.body.data.results).toBeDefined();
    expect(typeof res.body.data.results).toBe("object");
  });

  it("GET /search?q=xx&types=news — filtra por tipo y devuelve solo news", async () => {
    const res = await request(app)
      .get(`${API}/search`)
      .query({ q: "busqueda", barrioSlug, types: "news" });

    expect(res.status).toBe(200);
    expect(res.body.data.results.news).toBeDefined();
    // businesses no debe estar en los results si no se pidió
    expect(res.body.data.results.businesses).toBeUndefined();
  });

  it("GET /search — encuentra noticia publicada por texto", async () => {
    const res = await request(app)
      .get(`${API}/search`)
      .query({ q: "avanzada", barrioSlug, types: "news" });

    expect(res.status).toBe(200);
    expect(res.body.data.results.news.length).toBeGreaterThan(0);
  });
});
