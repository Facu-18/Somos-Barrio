import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../app";
import { API, createAdminAndLogin, registerAndLogin, seedBarrio } from "../../test/helpers";

describe("Admin — integration", () => {
  let adminToken: string;
  let vecinoToken: string;
  let createdBarrioSlug: string;
  let businessId: string;

  beforeAll(async () => {
    const admin = await createAdminAndLogin();
    adminToken = admin.token;

    const vecino = await registerAndLogin({ name: "Vecino Test" });
    vecinoToken = vecino.token;
  });

  it("GET /admin/stats — admin obtiene estadísticas", async () => {
    const res = await request(app)
      .get(`${API}/admin/stats`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.data.users).toBe("number");
    expect(typeof res.body.data.barrios).toBe("number");
  });

  it("GET /admin/stats — vecino recibe 403", async () => {
    const res = await request(app)
      .get(`${API}/admin/stats`)
      .set("Authorization", `Bearer ${vecinoToken}`);

    expect(res.status).toBe(403);
  });

  it("GET /admin/stats — sin token devuelve 401", async () => {
    const res = await request(app).get(`${API}/admin/stats`);
    expect(res.status).toBe(401);
  });

  it("POST /admin/barrios — admin crea barrio", async () => {
    const slug = `admin-barrio-${Date.now()}`;
    const res = await request(app)
      .post(`${API}/admin/barrios`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Barrio Admin Test", slug, city: "Rosario", province: "Santa Fe", country: "AR" });

    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe(slug);
    createdBarrioSlug = slug;
  });

  it("POST /admin/barrios — slug duplicado devuelve 409", async () => {
    const res = await request(app)
      .post(`${API}/admin/barrios`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Duplicado", slug: createdBarrioSlug, city: "Rosario", province: "Santa Fe", country: "AR" });

    expect(res.status).toBe(409);
  });

  it("PATCH /admin/barrios/:slug — admin actualiza barrio", async () => {
    const res = await request(app)
      .patch(`${API}/admin/barrios/${createdBarrioSlug}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ city: "Córdoba" });

    expect(res.status).toBe(200);
    expect(res.body.data.city).toBe("Córdoba");
  });

  it("PATCH /admin/businesses/:id/verify — admin puede verificar comercio", async () => {
    const barrio = await seedBarrio(`verify-barrio-${Date.now()}`);
    const owner = await registerAndLogin({ name: "Biz Owner" });

    const bRes = await request(app)
      .post(`${API}/barrios/${barrio.slug}/businesses`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Comercio Verificar", slug: `biz-verify-${Date.now()}`, category: "OTROS", address: "Av. Fake 1" });

    businessId = bRes.body.data.id;

    const res = await request(app)
      .patch(`${API}/admin/businesses/${businessId}/verify`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ verified: true });

    expect(res.status).toBe(200);
    expect(res.body.data.verified).toBe(true);
  });

  it("GET /admin/news — admin lista todas las noticias", async () => {
    const res = await request(app)
      .get(`${API}/admin/news`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it("DELETE /admin/barrios/:slug — admin elimina barrio", async () => {
    const res = await request(app)
      .delete(`${API}/admin/barrios/${createdBarrioSlug}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
  });
});
