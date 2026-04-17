import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../app";
import { API, registerAndLogin, seedBarrio } from "../../test/helpers";

describe("Comercios — integration", () => {
  let barrioSlug: string;
  let ownerToken: string;
  let businessSlug: string;

  beforeAll(async () => {
    const barrio = await seedBarrio(`biz-barrio-${Date.now()}`);
    barrioSlug = barrio.slug;

    const { token } = await registerAndLogin({ name: "Dueño Negocio" });
    ownerToken = token;
  });

  it("GET /barrios/:slug/businesses — lista vacía al inicio", async () => {
    const res = await request(app).get(`${API}/barrios/${barrioSlug}/businesses`);
    expect(res.status).toBe(200);
    // La respuesta tiene { data: { items: [], total: N, page: N, limit: N } }
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it("POST /barrios/:slug/businesses — usuario autenticado puede crear comercio", async () => {
    const slug = `biz-${Date.now()}`;
    const res = await request(app)
      .post(`${API}/barrios/${barrioSlug}/businesses`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Panadería Test",
        slug,
        category: "GASTRONOMIA",
        address: "Av. Santa Fe 1234",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe(slug);
    expect(res.body.data.verified).toBe(false);
    businessSlug = slug;
  });

  it("GET /barrios/:slug/businesses/:businessSlug — obtiene comercio", async () => {
    const res = await request(app).get(`${API}/barrios/${barrioSlug}/businesses/${businessSlug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe(businessSlug);
  });

  it("PATCH /barrios/:slug/businesses/:businessSlug — dueño puede actualizar", async () => {
    const res = await request(app)
      .patch(`${API}/barrios/${barrioSlug}/businesses/${businessSlug}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ description: "Descripción actualizada" });

    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe("Descripción actualizada");
  });

  it("POST /barrios/:slug/businesses — sin token devuelve 401", async () => {
    const res = await request(app)
      .post(`${API}/barrios/${barrioSlug}/businesses`)
      .send({ name: "Sin auth", slug: `noauth-${Date.now()}`, category: "OTROS", address: "X" });

    expect(res.status).toBe(401);
  });

  it("GET /barrios/:slug/businesses/:businessSlug — 404 para comercio inexistente", async () => {
    const res = await request(app).get(`${API}/barrios/${barrioSlug}/businesses/no-existe`);
    expect(res.status).toBe(404);
  });

  it("DELETE /barrios/:slug/businesses/:businessSlug — dueño puede borrar", async () => {
    const res = await request(app)
      .delete(`${API}/barrios/${barrioSlug}/businesses/${businessSlug}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(204);
  });
});
