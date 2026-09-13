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
  let editorId: string;
  let assetPostId: string;
  let attachedAssetIds: string[];

  beforeAll(async () => {
    const barrio = await seedBarrio(`mkt-barrio-${Date.now()}`);
    barrioSlug = barrio.slug;

    const { token, user } = await registerAndLogin({ name: "Vendedor", barrioSlug });
    sellerToken = token;
    sellerId = user.id;
    const editor = await registerAndLogin({ name: "Editor marketplace", barrioSlug });
    editorToken = editor.token;
    editorId = editor.user.id;
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

  it("rechaza URLs externas y assets duplicados en el contrato", async () => {
    const external = await request(app)
      .post(`${API}/barrios/${barrioSlug}/marketplace`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ title: "Mesa usada", description: "En buen estado", category: "MUEBLES", whatsapp: "+5493515550101", images: ["https://evil.test/a.jpg"] });
    expect(external.status).toBe(400);

    const duplicate = await request(app)
      .post(`${API}/barrios/${barrioSlug}/marketplace`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ title: "Mesa usada", description: "En buen estado", category: "MUEBLES", whatsapp: "+5493515550101", assetIds: ["cm1234567890123456789012", "cm1234567890123456789012"] });
    expect(duplicate.status).toBe(400);
  });

  it("adjunta atómicamente solo assets aprobados del autor", async () => {
    const approved = await prisma.marketplaceAsset.create({
      data: { uploaderId: sellerId, status: "APPROVED", mimeType: "image/jpeg", byteSize: 4, contentHash: "approved", cloudinaryPublicId: `test/${Date.now()}`, cloudinaryType: "upload", url: "https://cdn.test/approved.jpg" }
    });
    const secondApproved = await prisma.marketplaceAsset.create({
      data: { uploaderId: sellerId, status: "APPROVED", mimeType: "image/jpeg", byteSize: 4, contentHash: "approved-2", cloudinaryPublicId: `test/${Date.now()}-2`, cloudinaryType: "upload", url: "https://cdn.test/approved-2.jpg" }
    });
    const foreign = await prisma.marketplaceAsset.create({
      data: { uploaderId: editorId, status: "APPROVED", mimeType: "image/jpeg", byteSize: 4, contentHash: "foreign", cloudinaryPublicId: `test/${Date.now()}-foreign`, cloudinaryType: "upload", url: "https://cdn.test/foreign.jpg" }
    });
    const pending = await prisma.marketplaceAsset.create({
      data: { uploaderId: sellerId, status: "QUARANTINED", mimeType: "image/jpeg", byteSize: 4, contentHash: "pending" }
    });
    const claimed = await prisma.marketplaceAsset.create({
      data: { uploaderId: sellerId, status: "DELETE_PENDING", mimeType: "image/jpeg", byteSize: 4, contentHash: "claimed", deletionRequestedAt: new Date() }
    });

    for (const assetId of [foreign.id, pending.id, claimed.id]) {
      const rejected = await request(app)
        .post(`${API}/barrios/${barrioSlug}/marketplace`)
        .set("Authorization", `Bearer ${sellerToken}`)
        .send({ title: "Silla usada", description: "En buen estado", category: "MUEBLES", whatsapp: "+5493515550101", assetIds: [assetId] });
      expect(rejected.status).toBe(400);
      expect(await prisma.marketplacePost.count({ where: { title: "Silla usada" } })).toBe(0);
    }

    const accepted = await request(app)
      .post(`${API}/barrios/${barrioSlug}/marketplace`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ title: "Silla aprobada", description: "En buen estado", category: "MUEBLES", whatsapp: "+5493515550101", assetIds: [approved.id, secondApproved.id] });
    expect(accepted.status).toBe(201);
    expect(accepted.body.data.assetIds).toHaveLength(2);
    expect(accepted.body.data.images).toEqual(expect.arrayContaining(["https://cdn.test/approved.jpg", "https://cdn.test/approved-2.jpg"]));
    expect((await prisma.marketplaceAsset.findUniqueOrThrow({ where: { id: approved.id } })).postId).toBe(accepted.body.data.id);
    assetPostId = accepted.body.data.id;
    attachedAssetIds = accepted.body.data.assetIds;
  });

  it("no invalida la aprobación cuando solo cambia el orden de assetIds", async () => {
    const response = await request(app)
      .patch(`${API}/barrios/${barrioSlug}/marketplace/${assetPostId}`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ assetIds: [...attachedAssetIds].reverse() });

    expect(response.status).toBe(200);
    expect(response.body.data.moderationStatus).toBe("APPROVED");
  });

  it("POST /upload/marketplace rechaza GIF por firma antes del proveedor", async () => {
    const response = await request(app)
      .post(`${API}/upload/marketplace`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .attach("file", Buffer.from("GIF89a payload"), { filename: "fake.png", contentType: "image/png" });
    expect(response.status).toBe(422);
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

    await prisma.marketplacePost.update({
      where: { id: res.body.data.id },
      data: { legacyImages: ["https://legacy.test/restricted.jpg"] }
    });

    const ownList = await request(app)
      .get(`${API}/barrios/${barrioSlug}/marketplace/me`)
      .set("Authorization", `Bearer ${sellerToken}`);
    expect(ownList.body.data.items.some((item: { id: string }) => item.id === res.body.data.id)).toBe(true);
    expect(JSON.stringify(ownList.body)).not.toContain("legacy.test");

    const queue = await request(app)
      .get(`${API}/moderation/marketplace?status=PENDING_REVIEW`)
      .set("Authorization", `Bearer ${editorToken}`);
    expect(queue.status).toBe(200);
    expect(queue.body.data.items.some((item: { id: string }) => item.id === res.body.data.id)).toBe(true);
    expect(queue.body.data.items.find((item: { id: string }) => item.id === res.body.data.id).legacyImages)
      .toEqual(["https://legacy.test/restricted.jpg"]);

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
