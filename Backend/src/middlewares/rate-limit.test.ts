import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/redis", () => ({ redis: { call: vi.fn() } }));
// Los limiters del módulo se instancian al importarlo; un store inerte evita conectar a Redis.
vi.mock("rate-limit-redis", () => ({
  RedisStore: class {
    async increment() { return { totalHits: 1, resetTime: undefined }; }
    async decrement() {}
    async resetKey() {}
  }
}));

import express from "express";
import request from "supertest";
import { MemoryStore } from "express-rate-limit";
import { createForumWriteLimiter } from "./rate-limit";

function buildApp(keyBy: "user" | "ip", limit = 2) {
  const app = express();
  app.use((req, _res, next) => {
    const userId = req.header("x-user");
    if (userId) req.user = { id: userId, role: "VECINO", jti: "jti", tokenExp: 0 } as Express.Request["user"];
    next();
  });
  app.post(
    "/threads",
    createForumWriteLimiter({
      code: "FORUM_THREAD_RATE_LIMIT",
      message: "Alcanzaste el límite de hilos por hora.",
      limit,
      prefix: "test:",
      keyBy,
      store: new MemoryStore(),
      skip: () => false
    }),
    (_req, res) => { res.status(201).json({ success: true, data: null }); }
  );
  return app;
}

describe("createForumWriteLimiter", () => {
  it("responde 429 con el contrato de error y un código estable al superar el límite por usuario", async () => {
    const app = buildApp("user");

    expect((await request(app).post("/threads").set("x-user", "u1")).status).toBe(201);
    expect((await request(app).post("/threads").set("x-user", "u1")).status).toBe(201);
    const limited = await request(app).post("/threads").set("x-user", "u1");

    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({
      success: false,
      message: "Alcanzaste el límite de hilos por hora.",
      details: { code: "FORUM_THREAD_RATE_LIMIT" }
    });
    expect(limited.headers["ratelimit-policy"]).toBeDefined();
  });

  it("cuenta por usuario, no por red compartida", async () => {
    const app = buildApp("user", 1);

    expect((await request(app).post("/threads").set("x-user", "u1")).status).toBe(201);
    expect((await request(app).post("/threads").set("x-user", "u2")).status).toBe(201);
    expect((await request(app).post("/threads").set("x-user", "u1")).status).toBe(429);
  });

  it("el limitador por IP agrupa cuentas distintas desde la misma red", async () => {
    const app = buildApp("ip", 1);

    expect((await request(app).post("/threads").set("x-user", "u1")).status).toBe(201);
    expect((await request(app).post("/threads").set("x-user", "u2")).status).toBe(429);
  });
});
