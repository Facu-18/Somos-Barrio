import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../app";
import { API, registerAndLogin, seedBarrio } from "../../test/helpers";
import { prisma } from "../../lib/prisma";
import { moderationService } from "../moderation/moderation.service";

describe("Marketplace — integration", () => {
  let barrioSlug: string;
  let sellerToken: string;
  let postId: string;
  let outsiderToken: string;
  let sellerId: string;
  let editorToken: string;

  beforeAll(async () => {
    const barrio = await seedBarrio(`mkt-barrio-${Date.now()}`);
    barrioSlug = barrio.slug;

    const { token, user } = await registerAndLogin({ name: "Vendedor", barrioSlug });
    sellerToken = token;
    sellerId = user.id;
    const editor = await registerAndLogin({ name: "Editor marketplace", barrioSlug });
    editorToken = editor.token;
    await prisma.user.update({ where: { id: editor.user.id }, data: { role: "EDITOR" } });
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
    expect(res.body.data.moderationStatus).toBe("APPROVED");
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

  it("POST /barrios/:slug/marketplace — una evasión queda recuperable pero no pública", async () => {
    const res = await request(app)
      .post(`${API}/barrios/${barrioSlug}/marketplace`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({
        title: "Producto marhiu4na",
        description: "Producto de prueba ambiguo",
        category: "OTROS",
        whatsapp: "+5493515550101"
      });

    expect(res.status).toBe(201);
    expect(res.body.data.moderationStatus).toBe("PENDING_REVIEW");

    const publicList = await request(app).get(`${API}/barrios/${barrioSlug}/marketplace`);
    expect(publicList.body.data.items.some((item: { id: string }) => item.id === res.body.data.id)).toBe(false);

    const ownList = await request(app)
      .get(`${API}/barrios/${barrioSlug}/marketplace/me`)
      .set("Authorization", `Bearer ${sellerToken}`);
    expect(ownList.body.data.items.some((item: { id: string }) => item.id === res.body.data.id)).toBe(true);

    const queue = await request(app)
      .get(`${API}/moderation/marketplace?status=PENDING_REVIEW`)
      .set("Authorization", `Bearer ${editorToken}`);
    expect(queue.status).toBe(200);
    expect(queue.body.data.items.some((item: { id: string }) => item.id === res.body.data.id)).toBe(true);

    const report = await request(app)
      .post(`${API}/barrios/${barrioSlug}/marketplace/${res.body.data.id}/reports`)
      .set("Authorization", `Bearer ${editorToken}`)
      .send({ category: "OTHER" });
    expect(report.status).toBe(404);
  });

  it("PATCH /barrios/:slug/marketplace/:postId — una edición material invalida aprobación", async () => {
    const res = await request(app)
      .patch(`${API}/barrios/${barrioSlug}/marketplace/${postId}`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ title: "Bicicleta urbana usada" });

    expect(res.status).toBe(200);
    expect(res.body.data.moderationStatus).toBe("PENDING_REVIEW");

    const list = await request(app).get(`${API}/barrios/${barrioSlug}/marketplace`);
    expect(list.body.data.items.some((item: { id: string }) => item.id === postId)).toBe(false);
  });

  it("POST /moderation/marketplace/:postId/decision — otro moderador puede aprobar", async () => {
    const res = await request(app)
      .post(`${API}/moderation/marketplace/${postId}/decision`)
      .set("Authorization", `Bearer ${editorToken}`)
      .send({ decision: "APPROVE", reason: "Contenido permitido" });

    expect(res.status).toBe(200);
    expect(res.body.data.moderationStatus).toBe("APPROVED");
  });

  it("PATCH /barrios/:slug/marketplace/:postId — el dueño no controla moderación", async () => {
    const res = await request(app)
      .patch(`${API}/barrios/${barrioSlug}/marketplace/${postId}`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ moderationStatus: "APPROVED" });

    expect(res.status).toBe(400);
  });

  it("PATCH /barrios/:slug/marketplace/:postId — contenido prohibido queda rechazado", async () => {
    const res = await request(app)
      .patch(`${API}/barrios/${barrioSlug}/marketplace/${postId}`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ description: "Vendo marihuana" });

    expect(res.status).toBe(200);
    expect(res.body.data.moderationStatus).toBe("REJECTED");
    expect(res.body.data.moderationReasonCode).toBe("DRUGS");
  });

  it("un moderador no puede aprobar su propia publicación", async () => {
    await prisma.user.update({ where: { id: sellerId }, data: { role: "EDITOR" } });
    await expect(
      moderationService.moderateMarketplacePost(sellerId, postId, { decision: "APPROVE", reason: "Propia" })
    ).rejects.toMatchObject({ statusCode: 403 });
    await prisma.user.update({ where: { id: sellerId }, data: { role: "VECINO" } });
  });

  it("PATCH /barrios/:slug/marketplace/:postId — disponibilidad no altera moderación", async () => {
    const res = await request(app)
      .patch(`${API}/barrios/${barrioSlug}/marketplace/${postId}`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ availability: "SOLD" });

    expect(res.status).toBe(200);
    expect(res.body.data.availability).toBe("SOLD");
    expect(res.body.data.moderationStatus).toBe("REJECTED");

    const decisions = await prisma.marketplaceModerationDecision.count({ where: { postId } });
    expect(decisions).toBe(4);
  });

  it("DELETE /barrios/:slug/marketplace/:postId — dueño puede borrar", async () => {
    const res = await request(app)
      .delete(`${API}/barrios/${barrioSlug}/marketplace/${postId}`)
      .set("Authorization", `Bearer ${sellerToken}`);

    expect(res.status).toBe(204);
  });
});
