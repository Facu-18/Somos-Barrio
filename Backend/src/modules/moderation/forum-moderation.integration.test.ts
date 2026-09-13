import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { ForumContentStatus } from "@prisma/client";
import { app } from "../../app";
import { API, createAdminAndLogin, registerAndLogin, seedBarrio, testPrisma as prisma } from "../../test/helpers";
import { env } from "../../config/env";

type Kind = "threads" | "replies";

describe("Moderación del foro — integration", () => {
  let barrioSlug: string;
  let subforumSlug: string;
  let authorToken: string;
  let authorId: string;
  let neighborToken: string;
  let editorToken: string;
  let editorId: string;
  let outsiderEditorToken: string;
  let adminToken: string;
  let publishedThreadId: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const forum = () => `${API}/barrios/${barrioSlug}/forum/${subforumSlug}`;

  const createThread = async (token: string, title: string, content: string) => {
    const res = await request(app).post(`${forum()}/threads`).set(auth(token)).send({ title, content });
    expect(res.status).toBe(201);
    return res.body.data as { id: string; status: ForumContentStatus; moderationVersion: number };
  };

  const createReply = async (token: string, threadId: string, content: string) => {
    const res = await request(app).post(`${forum()}/threads/${threadId}/replies`).set(auth(token)).send({ content });
    expect(res.status).toBe(201);
    return res.body.data as { id: string; status: ForumContentStatus; moderationVersion: number };
  };

  const decide = (token: string, kind: Kind, id: string, body: Record<string, unknown>) =>
    request(app)
      .post(`${API}/moderation/forum/${kind}/${id}/decision`)
      .set(auth(token))
      .send({ reasonCode: "POLICY_COMPLIANT", idempotencyKey: randomUUID(), ...body });

  const decisionsOf = (where: { threadId?: string; replyId?: string }) =>
    prisma.forumModerationDecision.findMany({ where, orderBy: { toVersion: "asc" } });

  beforeAll(async () => {
    const barrio = await seedBarrio(`fmod-barrio-${Date.now()}`);
    barrioSlug = barrio.slug;
    const subforum = await prisma.forumSubforum.create({
      data: { name: "General", slug: `general-${Date.now()}`, barrioId: barrio.id }
    });
    subforumSlug = subforum.slug;

    const author = await registerAndLogin({ name: "Autora", barrioSlug });
    authorToken = author.token;
    authorId = author.user.id;
    neighborToken = (await registerAndLogin({ name: "Vecino", barrioSlug })).token;

    const editor = await registerAndLogin({ name: "Editora", barrioSlug });
    editorToken = editor.token;
    editorId = editor.user.id;
    await prisma.user.update({ where: { id: editorId }, data: { role: "EDITOR" } });

    const otherBarrio = await seedBarrio(`fmod-other-${Date.now()}`);
    const outsider = await registerAndLogin({ name: "Editor externo", barrioSlug: otherBarrio.slug });
    outsiderEditorToken = outsider.token;
    await prisma.user.update({ where: { id: outsider.user.id }, data: { role: "EDITOR" } });

    adminToken = (await createAdminAndLogin()).token;
    publishedThreadId = (await createThread(authorToken, "Corte de luz en la cuadra", "Desde las 18 hs no hay luz en la manzana.")).id;
  });

  describe("acceso por barrio", () => {
    let pendingThreadId: string;

    beforeAll(async () => {
      const thread = await createThread(authorToken, "Qué pelotudo el que estaciona mal", "Siempre deja el auto en la rampa.");
      expect(thread.status).toBe(ForumContentStatus.PENDING_REVIEW);
      pendingThreadId = thread.id;
    });

    it("un editor ve la cola de su barrio y no la de otros", async () => {
      const own = await request(app).get(`${API}/moderation/forum?target=THREAD&queue=PENDING_REVIEW`).set(auth(editorToken));
      expect(own.status).toBe(200);
      expect(own.body.data.items.map((item: { id: string }) => item.id)).toContain(pendingThreadId);

      // Aunque filtre por otro barrio, el editor queda fijo en el suyo.
      const outsider = await request(app)
        .get(`${API}/moderation/forum?target=THREAD&queue=PENDING_REVIEW&barrioSlug=${barrioSlug}`)
        .set(auth(outsiderEditorToken));
      expect(outsider.status).toBe(200);
      expect(outsider.body.data.items.map((item: { id: string }) => item.id)).not.toContain(pendingThreadId);
    });

    it("un editor no modera contenido de otro barrio", async () => {
      const res = await decide(outsiderEditorToken, "threads", pendingThreadId, { decision: "APPROVE", expectedVersion: 0 });
      expect(res.status).toBe(403);
      expect(await prisma.forumModerationDecision.count({ where: { threadId: pendingThreadId } })).toBe(1);
    });

    it("un administrador opera globalmente y la cola expone el historial interno", async () => {
      const queue = await request(app).get(`${API}/moderation/forum?target=THREAD&queue=PENDING_REVIEW`).set(auth(adminToken));
      const item = queue.body.data.items.find((entry: { id: string }) => entry.id === pendingThreadId);
      expect(item.decisions[0]).toMatchObject({ action: "AUTO_REVIEW", ruleId: "AR-INS-2" });

      const res = await decide(adminToken, "threads", pendingThreadId, { decision: "APPROVE", expectedVersion: 0 });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ForumContentStatus.PUBLISHED);
    });

    it("usuarios sin rol de moderación no acceden a la cola", async () => {
      const res = await request(app).get(`${API}/moderation/forum`).set(auth(neighborToken));
      expect(res.status).toBe(403);
    });
  });

  describe("decisiones atómicas e idempotentes", () => {
    it("una decisión concurrente sobre la misma versión se aplica una sola vez", async () => {
      const thread = await createThread(authorToken, "Sos un boludo si no reciclás", "Separen la basura, por favor.");
      const [first, second] = await Promise.all([
        decide(editorToken, "threads", thread.id, { decision: "APPROVE", expectedVersion: 0 }),
        decide(adminToken, "threads", thread.id, { decision: "BLOCK", reasonCode: "INAPPROPRIATE_CONTENT", expectedVersion: 0 })
      ]);

      expect([first.status, second.status].sort()).toEqual([200, 409]);
      expect(await prisma.forumModerationDecision.count({ where: { threadId: thread.id, actorId: { not: authorId } } })).toBe(1);
    });

    it("repetir la misma solicitud devuelve el resultado sin duplicar la decisión", async () => {
      const thread = await createThread(authorToken, "La plaza está una mierda", "Nadie corta el pasto hace meses.");
      const body = { decision: "APPROVE", expectedVersion: 0, idempotencyKey: randomUUID() };

      const first = await decide(editorToken, "threads", thread.id, body);
      const retry = await decide(editorToken, "threads", thread.id, body);
      expect(first.status).toBe(200);
      expect(retry.status).toBe(200);
      expect(retry.body.data.moderationVersion).toBe(1);

      const reused = await decide(editorToken, "threads", thread.id, { ...body, decision: "REMOVE", reasonCode: "SPAM", expectedVersion: 1 });
      expect(reused.status).toBe(409);
      expect(reused.body.message).toBe("IDEMPOTENCY_KEY_IN_USE");

      const stale = await decide(editorToken, "threads", thread.id, { decision: "REMOVE", reasonCode: "SPAM", expectedVersion: 0 });
      expect(stale.status).toBe(409);
      expect(stale.body.message).toBe("MODERATION_VERSION_CONFLICT");
      expect(await prisma.forumModerationDecision.count({ where: { threadId: thread.id } })).toBe(2);
    });

    it("rechaza transiciones inválidas y la autoaprobación", async () => {
      const invalid = await decide(editorToken, "threads", publishedThreadId, { decision: "BLOCK", reasonCode: "SPAM", expectedVersion: 0 });
      expect(invalid.status).toBe(409);
      expect(invalid.body.message).toBe("INVALID_MODERATION_TRANSITION");

      const ownThread = await createThread(editorToken, "Qué pelotudo el colectivo", "Pasa lleno y no para.");
      const selfApproval = await decide(editorToken, "threads", ownThread.id, { decision: "APPROVE", expectedVersion: 0 });
      expect(selfApproval.status).toBe(403);
      expect(selfApproval.body.message).toBe("CANNOT_MODERATE_OWN_CONTENT");
    });
  });

  describe("reportes", () => {
    it("un usuario no puede inflar el conteo reportando dos veces", async () => {
      const thread = await createThread(authorToken, "Feria del sábado", "Se suspende por lluvia.");
      const first = await request(app).post(`${forum()}/threads/${thread.id}/reports`).set(auth(neighborToken)).send({ category: "SPAM" });
      const again = await request(app).post(`${forum()}/threads/${thread.id}/reports`).set(auth(neighborToken)).send({ category: "HARASSMENT" });

      expect(first.status).toBe(201);
      expect(again.status).toBe(409);
      expect(again.body.message).toBe("ALREADY_REPORTED");
      expect(await prisma.forumReport.count({ where: { threadId: thread.id } })).toBe(1);

      const own = await request(app).post(`${forum()}/threads/${thread.id}/reports`).set(auth(authorToken)).send({ category: "SPAM" });
      expect(own.status).toBe(400);
    });

    it("al alcanzar el umbral oculta el contenido con una única decisión", async () => {
      const reply = await createReply(authorToken, publishedThreadId, "Llamen a EPEC, ya reclamé.");
      const reporters = [];
      for (let index = 0; index < env.FORUM_REPORT_THRESHOLD; index += 1) {
        reporters.push(await registerAndLogin({ name: `Reportante ${index}`, barrioSlug }));
      }

      const responses = await Promise.all(reporters.map(({ token }) => request(app)
        .post(`${forum()}/threads/${publishedThreadId}/replies/${reply.id}/reports`)
        .set(auth(token))
        .send({ category: "SPAM", comment: "Publicidad" })));
      expect(responses.every((response) => response.status === 201)).toBe(true);

      const stored = await prisma.forumReply.findUniqueOrThrow({ where: { id: reply.id } });
      expect(stored).toMatchObject({ status: ForumContentStatus.PENDING_REVIEW, moderationReasonCode: "REPORT_REVIEW" });
      expect(await prisma.forumModerationDecision.count({ where: { replyId: reply.id, action: "REPORT_THRESHOLD" } })).toBe(1);

      const queue = await request(app).get(`${API}/moderation/forum?target=REPLY&queue=REPORTED`).set(auth(editorToken));
      const item = queue.body.data.items.find((entry: { id: string }) => entry.id === reply.id);
      expect(item.reports).toHaveLength(env.FORUM_REPORT_THRESHOLD);

      // Desestimar los reportes vuelve a publicar y deja los reportes cerrados, sin borrarlos.
      const dismissed = await decide(editorToken, "replies", reply.id, { decision: "APPROVE", expectedVersion: stored.moderationVersion });
      expect(dismissed.status).toBe(200);
      expect(await prisma.forumReport.count({ where: { replyId: reply.id, status: "DISMISSED" } })).toBe(env.FORUM_REPORT_THRESHOLD);
    });
  });

  describe("publicación y notificaciones", () => {
    it("aprobar una respuesta retenida la publica y notifica una sola vez", async () => {
      const reply = await createReply(neighborToken, publishedThreadId, "sos un pelotudo, ya avisaron");
      expect(reply.status).toBe(ForumContentStatus.PENDING_REVIEW);
      const before = await prisma.notificationOutbox.count({ where: { userId: authorId } });

      const body = { decision: "APPROVE", expectedVersion: 0, idempotencyKey: randomUUID() };
      expect((await decide(editorToken, "replies", reply.id, body)).status).toBe(200);
      expect((await decide(editorToken, "replies", reply.id, body)).status).toBe(200);
      expect(await prisma.notificationOutbox.count({ where: { userId: authorId } })).toBe(before + 1);

      // Retirar y restaurar no vuelve a notificar.
      expect((await decide(editorToken, "replies", reply.id, { decision: "REMOVE", reasonCode: "HARASSMENT", expectedVersion: 1 })).status).toBe(200);
      expect((await decide(editorToken, "replies", reply.id, { decision: "RESTORE", expectedVersion: 2 })).status).toBe(200);
      expect(await prisma.notificationOutbox.count({ where: { userId: authorId } })).toBe(before + 1);
    });
  });

  describe("remover y restaurar", () => {
    it("remover oculta sin borrar historial y restaurar agrega una decisión nueva", async () => {
      const thread = await createThread(authorToken, "Perro perdido en Colón", "Es un caniche blanco con collar rojo.");
      const removed = await decide(editorToken, "threads", thread.id, { decision: "REMOVE", reasonCode: "SPAM", privateNote: "Duplicado del hilo anterior", expectedVersion: 0 });
      expect(removed.status).toBe(200);

      const list = await request(app).get(`${forum()}/threads?limit=50`);
      expect(list.body.data.items.map((item: { id: string }) => item.id)).not.toContain(thread.id);
      expect((await request(app).get(`${forum()}/threads/${thread.id}`)).status).toBe(404);
      const search = await request(app).get(`${API}/search?q=caniche&types=forum&barrioSlug=${barrioSlug}`);
      expect(search.body.data.results.forum).toHaveLength(0);
      expect(await prisma.forumThread.findUnique({ where: { id: thread.id } })).not.toBeNull();

      const author = await request(app).get(`${forum()}/threads/${thread.id}`).set(auth(authorToken));
      expect(author.body.data).toMatchObject({ status: ForumContentStatus.REMOVED, moderationReasonCode: "SPAM" });
      expect(author.body.data).not.toHaveProperty("moderationRuleId");

      const beforeRestore = await decisionsOf({ threadId: thread.id });
      const restored = await decide(editorToken, "threads", thread.id, { decision: "RESTORE", expectedVersion: 1 });
      expect(restored.status).toBe(200);
      const afterRestore = await decisionsOf({ threadId: thread.id });

      expect(afterRestore).toHaveLength(beforeRestore.length + 1);
      expect(afterRestore.slice(0, beforeRestore.length)).toEqual(beforeRestore);
      expect(afterRestore.at(-1)).toMatchObject({ action: "RESTORE", fromStatus: "REMOVED", toStatus: "PUBLISHED", actorId: editorId });
    });

    it("el borrado del autor es lógico y queda registrado", async () => {
      const thread = await createThread(authorToken, "Vendo bicicleta", "Rodado 26, casi nueva.");
      expect((await request(app).delete(`${forum()}/threads/${thread.id}`).set(auth(authorToken))).status).toBe(204);

      expect(await prisma.forumThread.findUnique({ where: { id: thread.id } })).toMatchObject({ deletedAt: expect.any(Date) });
      expect((await request(app).get(`${forum()}/threads/${thread.id}`).set(auth(authorToken))).status).toBe(404);
      expect((await decisionsOf({ threadId: thread.id })).at(-1)).toMatchObject({ action: "OWNER_DELETE", actorId: authorId });
    });
  });

  describe("corrección y apelación del autor", () => {
    it("una corrección limpia no deshace un bloqueo humano", async () => {
      const reply = await createReply(neighborToken, publishedThreadId, "sos un boludo total");
      expect((await decide(editorToken, "replies", reply.id, { decision: "BLOCK", reasonCode: "HARASSMENT", expectedVersion: 0 })).status).toBe(200);

      const edited = await request(app)
        .patch(`${forum()}/threads/${publishedThreadId}/replies/${reply.id}`)
        .set(auth(neighborToken))
        .send({ content: "Perdón, no coincido con tu opinión." });
      expect(edited.status).toBe(200);
      expect(edited.body.data).toMatchObject({ status: ForumContentStatus.PENDING_REVIEW, moderationReasonCode: "CONTENT_CORRECTED" });
    });

    it("el autor apela, conserva la razón y la aceptación publica con auditoría", async () => {
      const thread = await createThread(authorToken, "Reunión de consorcio", "El martes a las 20 en el SUM.");
      const blocked = await decide(editorToken, "threads", thread.id, { decision: "REMOVE", reasonCode: "SPAM", expectedVersion: 0 });
      expect(blocked.status).toBe(200);

      const detail = await request(app).get(`${forum()}/threads/${thread.id}`).set(auth(authorToken));
      expect(detail.body.data).toMatchObject({ status: ForumContentStatus.REMOVED, moderationReasonCode: "SPAM", moderationVersion: 1, appeals: [] });

      const appealBody = {
        statement: "No es spam: es la convocatoria oficial del consorcio del edificio.",
        expectedVersion: 1,
        idempotencyKey: randomUUID()
      };
      const byOther = await request(app).post(`${forum()}/threads/${thread.id}/appeals`).set(auth(neighborToken)).send(appealBody);
      expect(byOther.status).toBe(404);

      const appeal = await request(app).post(`${forum()}/threads/${thread.id}/appeals`).set(auth(authorToken)).send(appealBody);
      const retry = await request(app).post(`${forum()}/threads/${thread.id}/appeals`).set(auth(authorToken)).send(appealBody);
      expect(appeal.status).toBe(201);
      expect(retry.status).toBe(201);
      expect(retry.body.data.id).toBe(appeal.body.data.id);

      const duplicate = await request(app)
        .post(`${forum()}/threads/${thread.id}/appeals`)
        .set(auth(authorToken))
        .send({ ...appealBody, idempotencyKey: randomUUID() });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.message).toBe("APPEAL_ALREADY_PENDING");

      const queue = await request(app).get(`${API}/moderation/forum?target=THREAD&queue=APPEALED`).set(auth(editorToken));
      expect(queue.body.data.items.find((item: { id: string }) => item.id === thread.id).appeals[0].statement).toBe(appealBody.statement);

      const accepted = await decide(editorToken, "threads", thread.id, { decision: "APPROVE", expectedVersion: 1 });
      expect(accepted.status).toBe(200);
      expect(accepted.body.data.status).toBe(ForumContentStatus.PUBLISHED);
      expect(await prisma.forumAppeal.findUnique({ where: { id: appeal.body.data.id } })).toMatchObject({ status: "ACCEPTED", resolvedById: editorId });
      expect((await decisionsOf({ threadId: thread.id })).at(-1)).toMatchObject({ action: "APPEAL_ACCEPT", appealId: appeal.body.data.id });
    });

    it("rechazar una apelación mantiene el estado y registra la decisión", async () => {
      const reply = await createReply(neighborToken, publishedThreadId, "Estos negros de mierda otra vez");
      expect(reply.status).toBe(ForumContentStatus.BLOCKED);

      const appeal = await request(app)
        .post(`${forum()}/threads/${publishedThreadId}/replies/${reply.id}/appeals`)
        .set(auth(neighborToken))
        .send({ statement: "Era una cita textual de lo que escuché en la calle.", expectedVersion: 0, idempotencyKey: randomUUID() });
      expect(appeal.status).toBe(201);

      const rejected = await decide(editorToken, "replies", reply.id, { decision: "BLOCK", reasonCode: "DISCRIMINATION", expectedVersion: 0 });
      expect(rejected.status).toBe(200);
      expect(rejected.body.data).toMatchObject({ status: ForumContentStatus.BLOCKED, moderationReasonCode: "DISCRIMINATION" });
      expect(await prisma.forumAppeal.findUnique({ where: { id: appeal.body.data.id } })).toMatchObject({ status: "REJECTED" });
    });

    it("no se apela contenido publicado", async () => {
      const res = await request(app)
        .post(`${forum()}/threads/${publishedThreadId}/appeals`)
        .set(auth(authorToken))
        .send({ statement: "Quiero apelar aunque esté publicado el hilo.", expectedVersion: 0, idempotencyKey: randomUUID() });
      expect(res.status).toBe(409);
      expect(res.body.message).toBe("INVALID_APPEAL_STATE");
    });
  });

  describe("historial append-only", () => {
    it("cada transición genera una entrada encadenada por versión", async () => {
      const thread = await createThread(authorToken, "Qué pelotudo el vecino del 3B", "Deja la bolsa de basura en la vereda.");
      await request(app).patch(`${forum()}/threads/${thread.id}`).set(auth(authorToken)).send({ title: "Basura en la vereda del 3B" });
      const current = await prisma.forumThread.findUniqueOrThrow({ where: { id: thread.id } });
      await decide(editorToken, "threads", thread.id, { decision: "REMOVE", reasonCode: "HARASSMENT", expectedVersion: current.moderationVersion });

      const decisions = await decisionsOf({ threadId: thread.id });
      expect(decisions.map((decision) => decision.action)).toEqual(["AUTO_REVIEW", "OWNER_EDIT", "REMOVE"]);
      decisions.forEach((decision, index) => {
        expect(decision.toVersion).toBe(index);
        if (index > 0) {
          expect(decision.fromVersion).toBe(index - 1);
          expect(decision.fromStatus).toBe(decisions[index - 1].toStatus);
        }
      });
      expect(decisions[1]).toMatchObject({ policyVersion: "es-AR-1.1", contentHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    });

    it("la base rechaza modificar una decisión registrada", async () => {
      const [decision] = await decisionsOf({ threadId: publishedThreadId });
      await expect(
        prisma.$executeRaw`UPDATE "ForumModerationDecision" SET "reasonCode" = 'TAMPERED' WHERE id = ${decision.id}`
      ).rejects.toThrow(/append-only/);
    });
  });

  describe("métricas de overrides", () => {
    it("cuenta retenciones automáticas y aprobaciones humanas por regla", async () => {
      const res = await request(app).get(`${API}/moderation/forum/metrics`).set(auth(editorToken));
      expect(res.status).toBe(200);
      const insultRule = res.body.data.rules.find((rule: { ruleId: string }) => rule.ruleId === "AR-INS-2");
      expect(insultRule.retained).toBeGreaterThanOrEqual(2);
      expect(insultRule.overridden).toBeGreaterThanOrEqual(1);
      expect(insultRule.overrideRate).toBeGreaterThan(0);
      expect(res.body.data.rules.map((rule: { ruleId: string }) => rule.ruleId)).not.toContain("MANUAL_REVIEW");
    });
  });
});
