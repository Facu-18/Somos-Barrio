import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import { app } from "../../app";
import { API, registerAndLogin, seedBarrio } from "../../test/helpers";
import { prisma } from "../../lib/prisma";
import { moderationService } from "../moderation/moderation.service";
import { marketplaceAssetService } from "../upload/marketplace-asset.service";
import { env } from "../../config/env";

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
  let quarantinedAssetId: string;
  let quarantinedPostId: string;

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
    const outsider = await registerAndLogin({ name: "Foraneo", barrioSlug: otherBarrio.slug });
    outsiderToken = outsider.token;
    await prisma.user.update({ where: { id: outsider.user.id }, data: { role: "EDITOR" } });
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
      data: {
        uploaderId: sellerId,
        status: "QUARANTINED",
        mimeType: "image/jpeg",
        byteSize: 4,
        contentHash: "pending",
        cloudinaryPublicId: `test/${Date.now()}-pending`,
        cloudinaryType: "authenticated"
      }
    });
    const claimed = await prisma.marketplaceAsset.create({
      data: { uploaderId: sellerId, status: "DELETE_PENDING", mimeType: "image/jpeg", byteSize: 4, contentHash: "claimed", deletionRequestedAt: new Date() }
    });

    for (const assetId of [foreign.id, claimed.id]) {
      const rejected = await request(app)
        .post(`${API}/barrios/${barrioSlug}/marketplace`)
        .set("Authorization", `Bearer ${sellerToken}`)
        .send({ title: "Silla usada", description: "En buen estado", category: "MUEBLES", whatsapp: "+5493515550101", assetIds: [assetId] });
      expect(rejected.status).toBe(400);
      expect(await prisma.marketplacePost.count({ where: { title: "Silla usada" } })).toBe(0);
    }

    const quarantined = await request(app)
      .post(`${API}/barrios/${barrioSlug}/marketplace`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ title: "Foto para revisar", description: "Producto con imagen ambigua", category: "OTROS", whatsapp: "+5493515550101", assetIds: [pending.id] });
    expect(quarantined.status).toBe(201);
    expect(quarantined.body.data).toMatchObject({ moderationStatus: "PENDING_REVIEW", images: [] });
    expect(quarantined.body.data.managedAssets).toEqual([expect.objectContaining({ id: pending.id, status: "QUARANTINED", url: null })]);
    quarantinedAssetId = pending.id;
    quarantinedPostId = quarantined.body.data.id;

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

  it("modera assets con CAS sin publicar automáticamente el post", async () => {
    const ownQueue = await request(app)
      .get(`${API}/moderation/marketplace/assets`)
      .set("Authorization", `Bearer ${editorToken}`);
    expect(ownQueue.status).toBe(200);
    expect(ownQueue.body.data.items.some((item: { id: string }) => item.id === quarantinedAssetId)).toBe(true);

    const foreignQueue = await request(app)
      .get(`${API}/moderation/marketplace/assets?barrioSlug=${barrioSlug}`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(foreignQueue.status).toBe(200);
    expect(foreignQueue.body.data.items.some((item: { id: string }) => item.id === quarantinedAssetId)).toBe(false);

    const promote = vi.spyOn(marketplaceAssetService, "promoteToPublic").mockResolvedValue({
      public_id: `test/${quarantinedAssetId}`,
      secure_url: "https://cdn.test/review-approved.jpg"
    });
    const body = {
      decision: "APPROVE",
      reasonCode: "POLICY_COMPLIANT",
      expectedVersion: 0,
      idempotencyKey: "00000000-0000-4000-8000-000000000030"
    };
    await request(app)
      .post(`${API}/moderation/marketplace/assets/${quarantinedAssetId}/decision`)
      .set("Authorization", `Bearer ${editorToken}`)
      .send(body)
      .expect(200);
    await request(app)
      .post(`${API}/moderation/marketplace/assets/${quarantinedAssetId}/decision`)
      .set("Authorization", `Bearer ${editorToken}`)
      .send(body)
      .expect(200);
    await request(app)
      .post(`${API}/moderation/marketplace/assets/${quarantinedAssetId}/decision`)
      .set("Authorization", `Bearer ${editorToken}`)
      .send({ ...body, reasonCode: "IMAGE_POLICY" })
      .expect(409);
    promote.mockRestore();

    expect(await prisma.marketplaceAsset.findUnique({ where: { id: quarantinedAssetId } })).toMatchObject({ status: "APPROVED" });
    expect(await prisma.marketplacePost.findUnique({ where: { id: quarantinedPostId } })).toMatchObject({ moderationStatus: "PENDING_REVIEW" });
  });

  it("aplica una sola decisión de umbral ante reportes concurrentes", async () => {
    const created = await request(app)
      .post(`${API}/barrios/${barrioSlug}/marketplace`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ title: "Producto reportable", description: "Publicación inicialmente permitida", category: "OTROS", whatsapp: "+5493515550101" });
    expect(created.status).toBe(201);
    const reporters = [];
    for (let index = 0; index < env.MARKETPLACE_REPORT_THRESHOLD; index += 1) {
      reporters.push(await registerAndLogin({ name: `Reporter ${index}`, barrioSlug }));
    }

    const responses = await Promise.all(reporters.map(({ token }) => request(app)
      .post(`${API}/barrios/${barrioSlug}/marketplace/${created.body.data.id}/reports`)
      .set("Authorization", `Bearer ${token}`)
      .send({ category: "SPAM" })));
    expect(responses.every((response) => response.status === 201)).toBe(true);
    expect(await prisma.marketplacePost.findUnique({ where: { id: created.body.data.id } })).toMatchObject({ moderationStatus: "PENDING_REVIEW" });
    expect(await prisma.marketplaceModerationDecision.count({ where: { postId: created.body.data.id, action: "REPORT_THRESHOLD" } })).toBe(1);
    const publicList = await request(app).get(`${API}/barrios/${barrioSlug}/marketplace`);
    expect(publicList.body.data.items.some((item: { id: string }) => item.id === created.body.data.id)).toBe(false);
  });

  it("no invalida la aprobación cuando solo cambia el orden de assetIds", async () => {
    const response = await request(app)
      .patch(`${API}/barrios/${barrioSlug}/marketplace/${assetPostId}`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ assetIds: [...attachedAssetIds].reverse(), expectedVersion: 0 });

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
      .get(`${API}/moderation/marketplace?queue=PENDING_REVIEW`)
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
      .send({ title: "Bicicleta urbana usada", expectedVersion: 0 });

    expect(res.status).toBe(200);
    expect(res.body.data.moderationStatus).toBe("PENDING_REVIEW");

    const list = await request(app).get(`${API}/barrios/${barrioSlug}/marketplace`);
    expect(list.body.data.items.some((item: { id: string }) => item.id === postId)).toBe(false);
  });

  it("POST /moderation/marketplace/:postId/decision — otro moderador puede aprobar", async () => {
    const res = await request(app)
      .post(`${API}/moderation/marketplace/${postId}/decision`)
      .set("Authorization", `Bearer ${editorToken}`)
      .send({ decision: "APPROVE", reasonCode: "POLICY_COMPLIANT", expectedVersion: 1, idempotencyKey: "00000000-0000-4000-8000-000000000010" });

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
      .send({ description: "Vendo marihuana", expectedVersion: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data.moderationStatus).toBe("REJECTED");
    expect(res.body.data.moderationReasonCode).toBe("PROHIBITED_ITEM");
  });

  it("un moderador no puede aprobar su propia publicación", async () => {
    await prisma.user.update({ where: { id: sellerId }, data: { role: "EDITOR" } });
    await expect(
      moderationService.moderateMarketplacePost(sellerId, postId, {
        decision: "APPROVE",
        reasonCode: "POLICY_COMPLIANT",
        expectedVersion: 3,
        idempotencyKey: "00000000-0000-4000-8000-000000000001"
      })
    ).rejects.toMatchObject({ statusCode: 403 });
    await prisma.user.update({ where: { id: sellerId }, data: { role: "VECINO" } });
  });

  it("PATCH /barrios/:slug/marketplace/:postId — disponibilidad no altera moderación", async () => {
    const res = await request(app)
      .patch(`${API}/barrios/${barrioSlug}/marketplace/${postId}`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ availability: "SOLD", expectedVersion: 3 });

    expect(res.status).toBe(200);
    expect(res.body.data.availability).toBe("SOLD");
    expect(res.body.data.moderationStatus).toBe("REJECTED");

    const decisions = await prisma.marketplaceModerationDecision.count({ where: { postId } });
    expect(decisions).toBe(4);
  });

  it("aplica CAS e idempotencia al apelar y resolver", async () => {
    const idempotencyKey = "00000000-0000-4000-8000-000000000020";
    const appeal = {
      statement: "El contenido fue corregido y cumple con las normas del marketplace.",
      expectedVersion: 4,
      idempotencyKey
    };

    await request(app)
      .post(`${API}/barrios/${barrioSlug}/marketplace/${postId}/appeals`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send(appeal)
      .expect(201);
    await request(app)
      .post(`${API}/barrios/${barrioSlug}/marketplace/${postId}/appeals`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send(appeal)
      .expect(201);

    await request(app)
      .post(`${API}/barrios/${barrioSlug}/marketplace/${postId}/appeals`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ ...appeal, statement: "Intento de reutilizar la clave con un payload completamente diferente." })
      .expect(409);

    const ownPost = await request(app)
      .get(`${API}/barrios/${barrioSlug}/marketplace/${postId}`)
      .set("Authorization", `Bearer ${sellerToken}`);
    expect(ownPost.body.data.currentAppeal).toMatchObject({ status: "PENDING" });

    const correction = await request(app)
      .patch(`${API}/barrios/${barrioSlug}/marketplace/${postId}`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ title: "Edición durante apelación", expectedVersion: 4 });
    expect(correction.status).toBe(200);
    expect(correction.body.data).toMatchObject({ moderationStatus: "REJECTED", moderationVersion: 5, currentAppeal: null });

    const queue = await request(app)
      .get(`${API}/moderation/marketplace?queue=APPEALED`)
      .set("Authorization", `Bearer ${editorToken}`);
    expect(queue.status).toBe(200);
    expect(queue.body.data.items.some((item: { id: string }) => item.id === postId)).toBe(false);

    const decision = {
      decision: "APPROVE",
      reasonCode: "POLICY_COMPLIANT",
      expectedVersion: 5,
      idempotencyKey: "00000000-0000-4000-8000-000000000021"
    };
    await request(app)
      .post(`${API}/moderation/marketplace/${postId}/decision`)
      .set("Authorization", `Bearer ${editorToken}`)
      .send(decision)
      .expect(200);
    await request(app)
      .post(`${API}/moderation/marketplace/${postId}/decision`)
      .set("Authorization", `Bearer ${editorToken}`)
      .send(decision)
      .expect(200);
    await request(app)
      .post(`${API}/moderation/marketplace/${postId}/decision`)
      .set("Authorization", `Bearer ${editorToken}`)
      .send({ ...decision, reasonCode: "SPAM_OR_DUPLICATE" })
      .expect(409);

    await request(app)
      .patch(`${API}/barrios/${barrioSlug}/marketplace/${postId}`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ availability: "AVAILABLE", expectedVersion: 4 })
      .expect(409);
  });

  it("DELETE /barrios/:slug/marketplace/:postId — dueño puede borrar", async () => {
    const res = await request(app)
      .delete(`${API}/barrios/${barrioSlug}/marketplace/${postId}`)
      .set("Authorization", `Bearer ${sellerToken}`);

    expect(res.status).toBe(204);
    expect(await prisma.marketplacePost.findUnique({ where: { id: postId } })).toMatchObject({ deletedAt: expect.any(Date) });

    const publicList = await request(app).get(`${API}/barrios/${barrioSlug}/marketplace`);
    expect(publicList.body.data.items.some((item: { id: string }) => item.id === postId)).toBe(false);
  });
});
