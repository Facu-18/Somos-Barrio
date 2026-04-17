import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../app";
import { API, registerAndLogin, seedBarrio } from "../../test/helpers";

describe("Reseñas — integration", () => {
  let barrioSlug: string;
  let businessSlug: string;
  let userToken: string;

  beforeAll(async () => {
    const barrio = await seedBarrio(`reviews-barrio-${Date.now()}`);
    barrioSlug = barrio.slug;

    const owner = await registerAndLogin({ name: "Business Owner" });

    const bSlug = `biz-reviews-${Date.now()}`;
    await request(app)
      .post(`${API}/barrios/${barrioSlug}/businesses`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Comercio Reviews", slug: bSlug, category: "OTROS", address: "Calle 123" });
    businessSlug = bSlug;

    const user = await registerAndLogin({ name: "Reviewer" });
    userToken = user.token;
  });

  it("GET /reviews — lista vacía al inicio", async () => {
    const res = await request(app)
      .get(`${API}/barrios/${barrioSlug}/businesses/${businessSlug}/reviews`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.averageRating).toBeNull();
  });

  it("POST /reviews — sin token devuelve 401", async () => {
    const res = await request(app)
      .post(`${API}/barrios/${barrioSlug}/businesses/${businessSlug}/reviews`)
      .send({ rating: 4, comment: "Muy bueno" });

    expect(res.status).toBe(401);
  });

  it("POST /reviews — crea reseña correctamente", async () => {
    const res = await request(app)
      .post(`${API}/barrios/${barrioSlug}/businesses/${businessSlug}/reviews`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ rating: 4, comment: "Buena atención" });

    expect(res.status).toBe(201);
    expect(res.body.data.rating).toBe(4);
    expect(res.body.data.comment).toBe("Buena atención");
  });

  it("POST /reviews — segunda reseña del mismo usuario devuelve 409", async () => {
    const res = await request(app)
      .post(`${API}/barrios/${barrioSlug}/businesses/${businessSlug}/reviews`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ rating: 2, comment: "Ya cambié de opinión" });

    expect(res.status).toBe(409);
  });

  it("GET /reviews — calcula promedio correctamente", async () => {
    const user2 = await registerAndLogin({ name: "Reviewer 2" });

    await request(app)
      .post(`${API}/barrios/${barrioSlug}/businesses/${businessSlug}/reviews`)
      .set("Authorization", `Bearer ${user2.token}`)
      .send({ rating: 2 });

    const res = await request(app)
      .get(`${API}/barrios/${barrioSlug}/businesses/${businessSlug}/reviews`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.averageRating).toBe(3);
  });

  it("POST /reviews — rating fuera de rango devuelve 400", async () => {
    const user3 = await registerAndLogin({ name: "Reviewer 3" });

    const res = await request(app)
      .post(`${API}/barrios/${barrioSlug}/businesses/${businessSlug}/reviews`)
      .set("Authorization", `Bearer ${user3.token}`)
      .send({ rating: 6 });

    expect(res.status).toBe(400);
  });
});
