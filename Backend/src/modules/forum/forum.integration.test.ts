import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { ForumContentStatus, PrismaClient } from "@prisma/client";
import { app } from "../../app";
import { API, createAdminAndLogin, registerAndLogin, seedBarrio } from "../../test/helpers";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env["DATABASE_URL"] } },
});

describe("Foro — integration", () => {
  let barrioSlug: string;
  let barrioId: string;
  let subforumSlug: string;
  let threadId: string;
  let userToken: string;
  let userId: string;
  let otherToken: string;
  let thirdToken: string;
  let crossBarrioToken: string;
  let firstReplyId: string;

  const forum = () => `${API}/barrios/${barrioSlug}/forum/${subforumSlug}`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const barrio = await seedBarrio(`forum-barrio-${Date.now()}`);
    barrioSlug = barrio.slug;
    barrioId   = barrio.id;

    // Crear subforo directamente
    const subforum = await prisma.forumSubforum.create({
      data: { name: "General", slug: `general-${Date.now()}`, barrioId },
    });
    subforumSlug = subforum.slug;

    const u1 = await registerAndLogin({ name: "Forista", barrioSlug });
    userToken  = u1.token;
    userId     = u1.user.id;
    const u2 = await registerAndLogin({ name: "Otro", barrioSlug });
    otherToken = u2.token;
    thirdToken = (await registerAndLogin({ name: "Tercero", barrioSlug })).token;
    const otherBarrio = await seedBarrio(`forum-other-${Date.now()}`);
    crossBarrioToken = (await registerAndLogin({ name: "Forista Externo", barrioSlug: otherBarrio.slug })).token;
  });

  it("GET /barrios/:slug/forum — lista subforos", async () => {
    const res = await request(app).get(`${API}/barrios/${barrioSlug}/forum`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("POST /:subforumSlug/threads — usuario puede crear hilo", async () => {
    const res = await request(app)
      .post(`${forum()}/threads`)
      .set(auth(userToken))
      .send({ title: "  Hilo de prueba  ", content: "Contenido del hilo de prueba para test." });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe("Hilo de prueba");
    expect(res.body.data.status).toBe(ForumContentStatus.PUBLISHED);
    expect(res.body.data).not.toHaveProperty("moderationRuleId");
    expect(res.body.data).not.toHaveProperty("moderationContentHash");
    threadId = res.body.data.id;
  });

  it("GET /:subforumSlug/threads — lista hilos del subforo (paginada)", async () => {
    const res = await request(app).get(`${forum()}/threads`);
    expect(res.status).toBe(200);
    // La respuesta tiene { data: { items: [...], total, page, limit } }
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  it("GET /:subforumSlug/threads/:threadId — obtiene hilo con respuestas", async () => {
    const res = await request(app).get(`${forum()}/threads/${threadId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(threadId);
    expect(Array.isArray(res.body.data.replies)).toBe(true);
    expect(res.body.data.user).not.toHaveProperty("name");
    expect(res.body.data.user).not.toHaveProperty("avatarPublicId");
  });

  it("POST /:subforumSlug/threads/:threadId/replies — puede responder", async () => {
    const res = await request(app)
      .post(`${forum()}/threads/${threadId}/replies`)
      .set(auth(otherToken))
      .send({ content: "Respuesta de prueba al hilo." });

    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe("Respuesta de prueba al hilo.");
    expect(res.body.data.status).toBe(ForumContentStatus.PUBLISHED);
    firstReplyId = res.body.data.id;
  });

  it("encola avisos al padre inmediato y autor del hilo con deep link completo y texto genérico", async () => {
    const before = await prisma.notificationOutbox.count();
    const res = await request(app)
      .post(`${forum()}/threads/${threadId}/replies`)
      .set(auth(thirdToken))
      .send({ content: "Respuesta anidada con datos privados." });

    expect(res.status).toBe(201);
    const rows = await prisma.notificationOutbox.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 5000) } },
      orderBy: { createdAt: "desc" },
      take: 1
    });
    expect(await prisma.notificationOutbox.count()).toBe(before + 1);
    expect(rows[0].data).toMatchObject({ barrioSlug, subforumSlug, threadId, replyId: res.body.data.id });
    expect(rows[0].body).not.toContain("datos privados");

    const nested = await request(app)
      .post(`${forum()}/threads/${threadId}/replies`)
      .set(auth(thirdToken))
      .send({ content: "Respuesta anidada.", parentReplyId: firstReplyId });
    expect(nested.status).toBe(201);
    expect(await prisma.notificationOutbox.count()).toBe(before + 3);
  });

  it("rechaza respuestas de usuarios de otro barrio", async () => {
    const before = await prisma.notificationOutbox.count();
    const res = await request(app)
      .post(`${forum()}/threads/${threadId}/replies`)
      .set(auth(crossBarrioToken))
      .send({ content: "No deberia publicarse." });
    expect(res.status).toBe(403);
    expect(await prisma.notificationOutbox.count()).toBe(before);
  });

  it("rechaza contenido vacío después del trim", async () => {
    const res = await request(app)
      .post(`${forum()}/threads/${threadId}/replies`)
      .set(auth(otherToken))
      .send({ content: "   \n  " });
    expect(res.status).toBe(400);
  });

  it("POST /:subforumSlug/threads/:threadId/vote — voto toggle upvote", async () => {
    const res = await request(app)
      .post(`${forum()}/threads/${threadId}/vote`)
      .set(auth(otherToken))
      .send({ value: 1 });

    expect(res.status).toBe(200);
    // El servicio devuelve { voted: bool, value: 1|-1|null }
    expect(typeof res.body.data.voted).toBe("boolean");
  });

  describe("moderación de hilos", () => {
    let blockedThreadId: string;
    let pendingThreadId: string;

    it("bloquea un hilo con amenazas sin exponer la regla", async () => {
      const res = await request(app)
        .post(`${forum()}/threads`)
        .set(auth(userToken))
        .send({ title: "Aviso al vecino ruidoso", content: "Si seguís con la música te voy a matar." });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe(ForumContentStatus.BLOCKED);
      expect(res.body.data.moderationReasonCode).toBe("THREAT");
      expect(res.body.data).not.toHaveProperty("moderationRuleId");
      blockedThreadId = res.body.data.id;
    });

    it("deja pendiente un hilo ambiguo", async () => {
      const res = await request(app)
        .post(`${forum()}/threads`)
        .set(auth(userToken))
        .send({ title: "Qué pelotudo el que estaciona en la rampa", content: "Siempre bloquea la rampa de la esquina." });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe(ForumContentStatus.PENDING_REVIEW);
      pendingThreadId = res.body.data.id;
    });

    it("no muestra hilos retenidos en listados, conteos, detalle ni búsqueda públicos", async () => {
      const list = await request(app).get(`${forum()}/threads?limit=50`);
      const ids = list.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).not.toContain(blockedThreadId);
      expect(ids).not.toContain(pendingThreadId);
      expect(list.body.data.total).toBe(1);

      const othersList = await request(app).get(`${forum()}/threads?limit=50`).set(auth(otherToken));
      expect(othersList.body.data.total).toBe(1);

      const subforums = await request(app).get(`${API}/barrios/${barrioSlug}/forum`);
      const subforum = subforums.body.data.find((item: { slug: string }) => item.slug === subforumSlug);
      expect(subforum._count.threads).toBe(1);

      expect((await request(app).get(`${forum()}/threads/${blockedThreadId}`)).status).toBe(404);
      expect((await request(app).get(`${forum()}/threads/${pendingThreadId}`).set(auth(otherToken))).status).toBe(404);

      const search = await request(app).get(`${API}/search?q=rampa&types=forum&barrioSlug=${barrioSlug}`);
      expect(search.status).toBe(200);
      expect(search.body.data.results.forum).toHaveLength(0);
    });

    it("el autor ve sus hilos retenidos con su estado", async () => {
      const list = await request(app).get(`${forum()}/threads?limit=50`).set(auth(userToken));
      const ids = list.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toEqual(expect.arrayContaining([blockedThreadId, pendingThreadId]));

      const detail = await request(app).get(`${forum()}/threads/${blockedThreadId}`).set(auth(userToken));
      expect(detail.status).toBe(200);
      expect(detail.body.data.status).toBe(ForumContentStatus.BLOCKED);
    });

    it("un administrador puede ver un hilo retenido", async () => {
      const admin = await createAdminAndLogin();
      const res = await request(app).get(`${forum()}/threads/${pendingThreadId}`).set(auth(admin.token));
      expect(res.status).toBe(200);
    });

    it("no permite responder ni votar hilos no publicados", async () => {
      const before = await prisma.notificationOutbox.count();
      const byOther = await request(app)
        .post(`${forum()}/threads/${blockedThreadId}/replies`)
        .set(auth(otherToken))
        .send({ content: "Respuesta a un hilo bloqueado." });
      expect(byOther.status).toBe(404);

      const byAuthor = await request(app)
        .post(`${forum()}/threads/${blockedThreadId}/replies`)
        .set(auth(userToken))
        .send({ content: "Respuesta a mi hilo bloqueado." });
      expect(byAuthor.status).toBe(409);
      expect(byAuthor.body.message).toBe("THREAD_NOT_PUBLISHED");

      const vote = await request(app)
        .post(`${forum()}/threads/${pendingThreadId}/vote`)
        .set(auth(otherToken))
        .send({ value: 1 });
      expect(vote.status).toBe(404);
      expect(await prisma.notificationOutbox.count()).toBe(before);
    });

    it("el autor corrige un hilo bloqueado y queda publicado", async () => {
      const byOther = await request(app)
        .patch(`${forum()}/threads/${blockedThreadId}`)
        .set(auth(otherToken))
        .send({ content: "Intento editar un hilo ajeno." });
      expect(byOther.status).toBe(404);

      const res = await request(app)
        .patch(`${forum()}/threads/${blockedThreadId}`)
        .set(auth(userToken))
        .send({ content: "Por favor, bajen la música después de las 23 hs." });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ForumContentStatus.PUBLISHED);
      expect(res.body.data.moderationReasonCode).toBeNull();
      expect((await request(app).get(`${forum()}/threads/${blockedThreadId}`)).status).toBe(200);
    });

    it("no permite editar contenido removido por moderación", async () => {
      await prisma.forumThread.update({ where: { id: pendingThreadId }, data: { status: ForumContentStatus.REMOVED } });
      const res = await request(app)
        .patch(`${forum()}/threads/${pendingThreadId}`)
        .set(auth(userToken))
        .send({ title: "Título corregido para el hilo" });
      expect(res.status).toBe(409);
      expect(res.body.message).toBe("CONTENT_REMOVED");
    });
  });

  describe("moderación de respuestas", () => {
    let blockedReplyId: string;
    let pendingReplyId: string;

    it("bloquea una respuesta grave sin generar notificaciones", async () => {
      const before = await prisma.notificationOutbox.count();
      const res = await request(app)
        .post(`${forum()}/threads/${threadId}/replies`)
        .set(auth(otherToken))
        .send({ content: "Sos un hijo de puta.", parentReplyId: firstReplyId });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe(ForumContentStatus.BLOCKED);
      expect(res.body.data.moderationReasonCode).toBe("INAPPROPRIATE_CONTENT");
      expect(await prisma.notificationOutbox.count()).toBe(before);
      blockedReplyId = res.body.data.id;
    });

    it("deja pendiente una respuesta ofuscada sin generar notificaciones", async () => {
      const before = await prisma.notificationOutbox.count();
      const res = await request(app)
        .post(`${forum()}/threads/${threadId}/replies`)
        .set(auth(thirdToken))
        .send({ content: "t3 v0y a m4tar" });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe(ForumContentStatus.PENDING_REVIEW);
      expect(await prisma.notificationOutbox.count()).toBe(before);
      pendingReplyId = res.body.data.id;
    });

    it("oculta respuestas retenidas del detalle público y del conteo", async () => {
      const publicDetail = await request(app).get(`${forum()}/threads/${threadId}`);
      const publicIds = publicDetail.body.data.replies.map((reply: { id: string }) => reply.id);
      expect(publicIds).not.toContain(blockedReplyId);
      expect(publicIds).not.toContain(pendingReplyId);
      expect(publicDetail.body.data._count.replies).toBe(3);

      const list = await request(app).get(`${forum()}/threads?limit=50`);
      const thread = list.body.data.items.find((item: { id: string }) => item.id === threadId);
      expect(thread._count.replies).toBe(3);

      const authorDetail = await request(app).get(`${forum()}/threads/${threadId}`).set(auth(otherToken));
      const authorIds = authorDetail.body.data.replies.map((reply: { id: string }) => reply.id);
      expect(authorIds).toContain(blockedReplyId);
      expect(authorIds).not.toContain(pendingReplyId);
    });

    it("rechaza respuestas a un padre no publicado", async () => {
      const res = await request(app)
        .post(`${forum()}/threads/${threadId}/replies`)
        .set(auth(userToken))
        .send({ content: "Respondo a algo retenido.", parentReplyId: pendingReplyId });
      expect(res.status).toBe(409);
      expect(res.body.message).toBe("PARENT_REPLY_UNAVAILABLE");
    });

    it("no permite votar respuestas retenidas", async () => {
      const res = await request(app)
        .post(`${forum()}/threads/${threadId}/replies/${pendingReplyId}/vote`)
        .set(auth(userToken))
        .send({ value: 1 });
      expect(res.status).toBe(404);
    });

    it("al corregir una respuesta bloqueada se publica y notifica una sola vez", async () => {
      const before = await prisma.notificationOutbox.count();
      const byOther = await request(app)
        .patch(`${forum()}/threads/${threadId}/replies/${blockedReplyId}`)
        .set(auth(userToken))
        .send({ content: "Edición ajena." });
      expect(byOther.status).toBe(404);

      const fixed = await request(app)
        .patch(`${forum()}/threads/${threadId}/replies/${blockedReplyId}`)
        .set(auth(otherToken))
        .send({ content: "Perdón, me enojé. No coincido con lo que decís." });
      expect(fixed.status).toBe(200);
      expect(fixed.body.data.status).toBe(ForumContentStatus.PUBLISHED);
      // Padre (autor de la primera respuesta es otherToken, se excluye) + autor del hilo.
      expect(await prisma.notificationOutbox.count()).toBe(before + 1);

      const editedAgain = await request(app)
        .patch(`${forum()}/threads/${threadId}/replies/${blockedReplyId}`)
        .set(auth(otherToken))
        .send({ content: "No coincido con lo que decís." });
      expect(editedAgain.status).toBe(200);
      expect(await prisma.notificationOutbox.count()).toBe(before + 1);
    });

    it("una edición publicada que se vuelve grave queda oculta", async () => {
      const res = await request(app)
        .patch(`${forum()}/threads/${threadId}/replies/${blockedReplyId}`)
        .set(auth(otherToken))
        .send({ content: "Negros de mierda." });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ForumContentStatus.BLOCKED);

      const publicDetail = await request(app).get(`${forum()}/threads/${threadId}`);
      const publicIds = publicDetail.body.data.replies.map((reply: { id: string }) => reply.id);
      expect(publicIds).not.toContain(blockedReplyId);
    });
  });

  describe("hilos cerrados", () => {
    it("una llamada directa no puede responder ni editar en un hilo cerrado", async () => {
      const close = await request(app)
        .post(`${forum()}/threads/${threadId}/close`)
        .set(auth(userToken));
      expect(close.status).toBe(200);
      expect(close.body.data).not.toHaveProperty("moderationRuleId");

      const before = await prisma.notificationOutbox.count();
      const reply = await request(app)
        .post(`${forum()}/threads/${threadId}/replies`)
        .set(auth(otherToken))
        .send({ content: "Respuesta a hilo cerrado." });
      expect(reply.status).toBe(409);
      expect(reply.body.message).toBe("THREAD_CLOSED");

      const edit = await request(app)
        .patch(`${forum()}/threads/${threadId}/replies/${firstReplyId}`)
        .set(auth(otherToken))
        .send({ content: "Edito después del cierre." });
      expect(edit.status).toBe(409);
      expect(edit.body.message).toBe("THREAD_CLOSED");

      expect(await prisma.notificationOutbox.count()).toBe(before);
      expect(await prisma.forumReply.count({ where: { threadId, userId } })).toBe(0);
    });
  });

  it("DELETE /:subforumSlug/threads/:threadId — autor puede borrar", async () => {
    const res = await request(app)
      .delete(`${forum()}/threads/${threadId}`)
      .set(auth(userToken));

    expect(res.status).toBe(204);
  });
});
