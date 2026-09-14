import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../app";
import { API, createAdminAndLogin, registerAndLogin, seedBarrio, testPrisma as prisma } from "../../test/helpers";
import { metrics } from "../../lib/metrics";

describe("Observabilidad — integration", () => {
  let barrioSlug: string;
  let subforumSlug: string;
  let authorToken: string;
  let neighborToken: string;
  let editorToken: string;
  let adminToken: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const barrio = await seedBarrio(`obs-barrio-${Date.now()}`);
    barrioSlug = barrio.slug;
    subforumSlug = (await prisma.forumSubforum.create({ data: { name: "General", slug: `general-${Date.now()}`, barrioId: barrio.id } })).slug;
    authorToken = (await registerAndLogin({ name: "Autora obs", barrioSlug })).token;
    neighborToken = (await registerAndLogin({ name: "Vecino obs", barrioSlug })).token;
    const editor = await registerAndLogin({ name: "Editora obs", barrioSlug });
    await prisma.user.update({ where: { id: editor.user.id }, data: { role: "EDITOR" } });
    editorToken = editor.token;
    adminToken = (await createAdminAndLogin()).token;
  });

  describe("correlation id", () => {
    it("toda respuesta lleva X-Request-Id", async () => {
      const res = await request(app).get(`${API}/health`);
      expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("respeta un id entrante válido y reemplaza uno con datos personales", async () => {
      const valid = await request(app).get(`${API}/health`).set("X-Request-Id", "cliente-req-12345678");
      expect(valid.headers["x-request-id"]).toBe("cliente-req-12345678");

      const personal = await request(app).get(`${API}/health`).set("X-Request-Id", "vecina@barrio.com");
      expect(personal.headers["x-request-id"]).not.toContain("@");
    });
  });

  it("GET /metrics no existe sin METRICS_TOKEN configurado", async () => {
    expect((await request(app).get("/metrics")).status).toBe(404);
  });

  describe("resumen de moderación", () => {
    beforeAll(async () => {
      const forum = `${API}/barrios/${barrioSlug}/forum/${subforumSlug}/threads`;
      await request(app).post(forum).set(auth(authorToken)).send({ title: "Feria de artesanos", content: "El sábado en la plaza central." });
      await request(app).post(forum).set(auth(authorToken)).send({ title: "Qué pelotudo el que estaciona", content: "Siempre bloquea la rampa." });
      await request(app).post(forum).set(auth(neighborToken)).send({ title: "Aviso al vecino", content: "Si seguís así te voy a matar." });
    });

    it("cuenta decisiones ALLOW/REVIEW/BLOCK, colas y versiones de política del barrio", async () => {
      const res = await request(app).get(`${API}/moderation/metrics/overview?days=1`).set(auth(editorToken));

      expect(res.status).toBe(200);
      expect(res.body.data.scope).toBe("BARRIO");
      expect(res.body.data.moderation.forum.automated).toEqual({ ALLOW: 1, REVIEW: 1, BLOCK: 1 });
      expect(res.body.data.moderation.forum.policyVersions).toEqual({ "es-AR-1.1": 3 });
      expect(res.body.data.moderation.automatedBlocksLastHour).toBe(1);
      expect(res.body.data.queues.forum.pendingThreads).toBe(1);
      expect(res.body.data.queues.oldestPendingAt).toEqual(expect.any(String));
      expect(Array.isArray(res.body.data.alerts)).toBe(true);
      // El presupuesto global de IA no se expone a editores.
      expect(res.body.data.ai.budget).toBeNull();
    });

    it("un administrador ve el alcance global y el presupuesto de IA", async () => {
      const res = await request(app).get(`${API}/moderation/metrics/overview`).set(auth(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.data.scope).toBe("GLOBAL");
      expect(res.body.data.ai.budget).toMatchObject({ limit: expect.any(Number), spent: expect.any(Number), resetsAt: expect.any(String) });
    });

    it("usuarios sin rol de moderación no acceden", async () => {
      expect((await request(app).get(`${API}/moderation/metrics/overview`).set(auth(neighborToken))).status).toBe(403);
    });

    it("cada decisión identifica regla y versión de política sin exponer secretos", async () => {
      const decisions = await prisma.forumModerationDecision.findMany({
        where: { barrio: { slug: barrioSlug } },
        select: { action: true, ruleId: true, policyVersion: true, contentHash: true, toStatus: true }
      });
      expect(decisions).toHaveLength(3);
      for (const decision of decisions) {
        expect(decision.policyVersion).toBe("es-AR-1.1");
        expect(decision.ruleId).toBeTruthy();
        expect(decision.contentHash).toMatch(/^[a-f0-9]{64}$/);
      }
      expect(JSON.stringify(decisions)).not.toMatch(/api[_-]?key|secret|password|Bearer/i);
    });

    it("las decisiones automáticas alimentan los counters de Prometheus", () => {
      const output = metrics.renderPrometheus();
      expect(output).toMatch(/moderation_automated_decisions_total\{decision="BLOCK",domain="FORUM",policyVersion="es-AR-1\.1"\} \d+/);
      expect(output).not.toMatch(/matar|pelotudo|artesanos/);
    });
  });

  describe("contenido pendiente del marketplace", () => {
    it("no aparece en listado, conteo, detalle ajeno ni búsqueda", async () => {
      const keyword = `zapatillasobs${Date.now()}`;
      const created = await request(app).post(`${API}/barrios/${barrioSlug}/marketplace`).set(auth(authorToken)).send({
        title: `Vendo ${keyword} usadas`,
        description: "Sos un boludo si no las comprás",
        category: "OTROS",
        whatsapp: "+5493515550101"
      });
      expect(created.status).toBe(201);
      expect(created.body.data.moderationStatus).toBe("PENDING_REVIEW");

      const list = await request(app).get(`${API}/barrios/${barrioSlug}/marketplace?limit=50`);
      expect(list.body.data.items.map((item: { id: string }) => item.id)).not.toContain(created.body.data.id);
      expect(list.body.data.total).toBe(list.body.data.items.length);

      const detail = await request(app).get(`${API}/barrios/${barrioSlug}/marketplace/${created.body.data.id}`).set(auth(neighborToken));
      expect(detail.status).toBe(404);

      const search = await request(app).get(`${API}/search?q=${keyword}&types=marketplace&barrioSlug=${barrioSlug}`);
      expect(search.status).toBe(200);
      expect(search.body.data.results.marketplace).toHaveLength(0);
    });
  });
});
