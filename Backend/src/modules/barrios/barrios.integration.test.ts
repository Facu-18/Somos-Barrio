import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../app";
import { API, createAdminAndLogin, seedBarrio } from "../../test/helpers";

describe("Barrios — integration", () => {
  let slug: string;

  beforeAll(async () => {
    const barrio = await seedBarrio();
    slug = barrio.slug;
  });

  it("GET /barrios — lista barrios", async () => {
    const res = await request(app).get(`${API}/barrios`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("GET /barrios/:slug — devuelve barrio por slug", async () => {
    const res = await request(app).get(`${API}/barrios/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe(slug);
  });

  it("GET /barrios/:slug — 404 para slug inexistente", async () => {
    const res = await request(app).get(`${API}/barrios/no-existe-este-barrio`);
    expect(res.status).toBe(404);
  });

  it("POST /admin/barrios — ADMIN puede crear barrio", async () => {
    const { token } = await createAdminAndLogin();
    const newSlug = `admin-barrio-${Date.now()}`;

    const res = await request(app)
      .post(`${API}/admin/barrios`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Admin Barrio", slug: newSlug, city: "Córdoba", province: "Córdoba" });

    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe(newSlug);
  });

  it("POST /admin/barrios — VECINO no puede crear barrio", async () => {
    const loginRes = await request(app)
      .post(`${API}/auth/register`)
      .send({ email: `vecino_${Date.now()}@test.com`, password: "Password123!", name: "Vecino" });

    const token = loginRes.body.data?.accessToken as string;

    const res = await request(app)
      .post(`${API}/admin/barrios`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Intento", slug: `intento-${Date.now()}`, city: "BA", province: "BA" });

    expect(res.status).toBe(403);
  });
});
