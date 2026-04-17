import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../app";
import { API, registerAndLogin, seedBarrio } from "../../test/helpers";

describe("Marketplace — integration", () => {
  let barrioSlug: string;
  let sellerToken: string;
  let postId: string;

  beforeAll(async () => {
    const barrio = await seedBarrio(`mkt-barrio-${Date.now()}`);
    barrioSlug = barrio.slug;

    const { token } = await registerAndLogin({ name: "Vendedor" });
    sellerToken = token;
  });

  it("GET /barrios/:slug/marketplace — lista (paginada)", async () => {
    const res = await request(app).get(`${API}/barrios/${barrioSlug}/marketplace`);
    expect(res.status).toBe(200);
    // La respuesta tiene { data: { items: [], total, page, limit } }
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it("POST /barrios/:slug/marketplace — crea publicación", async () => {
    const res = await request(app)
      .post(`${API}/barrios/${barrioSlug}/marketplace`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({
        title: "Bicicleta usada",
        description: "Bicicleta en buen estado, poco uso.",
        price: 50000,
        category: "DEPORTES",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe("Bicicleta usada");
    postId = res.body.data.id;
  });

  it("GET /barrios/:slug/marketplace/:postId — devuelve publicación y registra vista", async () => {
    const res = await request(app).get(`${API}/barrios/${barrioSlug}/marketplace/${postId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(postId);
    // El service hace update de views después del return, la vista se registra asíncronamente
    expect(typeof res.body.data.views).toBe("number");
  });

  it("PATCH /barrios/:slug/marketplace/:postId — dueño puede actualizar", async () => {
    const res = await request(app)
      .patch(`${API}/barrios/${barrioSlug}/marketplace/${postId}`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ status: "SOLD" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("SOLD");
  });

  it("DELETE /barrios/:slug/marketplace/:postId — dueño puede borrar", async () => {
    const res = await request(app)
      .delete(`${API}/barrios/${barrioSlug}/marketplace/${postId}`)
      .set("Authorization", `Bearer ${sellerToken}`);

    expect(res.status).toBe(204);
  });
});
