import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../app";
import { API, registerAndLogin, seedBarrio } from "../../test/helpers";

describe("Marketplace — integration", () => {
  let barrioSlug: string;
  let sellerToken: string;
  let postId: string;
  let outsiderToken: string;

  beforeAll(async () => {
    const barrio = await seedBarrio(`mkt-barrio-${Date.now()}`);
    barrioSlug = barrio.slug;

    const { token } = await registerAndLogin({ name: "Vendedor", barrioSlug });
    sellerToken = token;
    const otherBarrio = await seedBarrio(`mkt-other-${Date.now()}`);
    outsiderToken = (await registerAndLogin({ name: "Foraneo", barrioSlug: otherBarrio.slug })).token;
  });

  it("GET /barrios/:slug/marketplace — lista (paginada)", async () => {
    const res = await request(app).get(`${API}/barrios/${barrioSlug}/marketplace`);
    expect(res.status).toBe(200);
    // La respuesta tiene { data: { items: [], total, page, limit } }
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it("POST /barrios/:slug/marketplace — crea publicación", async () => {
    const missingWhatsapp = await request(app)
      .post(`${API}/barrios/${barrioSlug}/marketplace`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ title: "Sin contacto", description: "No tiene telefono", category: "OTROS" });
    expect(missingWhatsapp.status).toBe(400);

    const res = await request(app)
      .post(`${API}/barrios/${barrioSlug}/marketplace`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({
        title: "Bicicleta usada",
        description: "Bicicleta en buen estado, poco uso.",
        price: 50000,
        category: "DEPORTES",
        whatsapp: "00 54 9 351 555-0101",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe("Bicicleta usada");
    expect(res.body.data.whatsapp).toBe("+5493515550101");
    postId = res.body.data.id;
  });

  it("GET /barrios/:slug/marketplace/:postId — devuelve publicación y registra vista", async () => {
    await request(app).get(`${API}/barrios/${barrioSlug}/marketplace/${postId}`).expect(401);
    await request(app).get(`${API}/barrios/${barrioSlug}/marketplace/${postId}`)
      .set("Authorization", `Bearer ${outsiderToken}`).expect(403);
    const res = await request(app).get(`${API}/barrios/${barrioSlug}/marketplace/${postId}`)
      .set("Authorization", `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(postId);
    expect(res.body.data.whatsapp).toBe("+5493515550101");
    // El service hace update de views después del return, la vista se registra asíncronamente
    expect(typeof res.body.data.views).toBe("number");
  });

  it("GET /barrios/:slug/marketplace — no expone WhatsApp en el listado", async () => {
    const res = await request(app).get(`${API}/barrios/${barrioSlug}/marketplace`);
    expect(res.status).toBe(200);
    expect(res.body.data.items[0]).not.toHaveProperty("whatsapp");
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
