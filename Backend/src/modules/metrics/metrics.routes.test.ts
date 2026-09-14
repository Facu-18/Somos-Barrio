import { describe, expect, it, vi } from "vitest";

vi.mock("../../config/env", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../config/env")>();
  return { ...original, env: { ...original.env, METRICS_TOKEN: "metrics-token-de-prueba-123456" } };
});
vi.mock("./metrics.service", () => ({
  metricsService: { prometheusGauges: vi.fn(async () => [{ name: "moderation_queue_pending", help: "Cola", value: 4, labels: { domain: "FORUM", kind: "thread" } }]) }
}));

import express from "express";
import request from "supertest";
import { metricsRouter } from "./metrics.routes";
import { errorHandler } from "../../middlewares/error-handler";

const app = express().use("/metrics", metricsRouter).use(errorHandler);

describe("GET /metrics", () => {
  it("exige el token de métricas", async () => {
    expect((await request(app).get("/metrics")).status).toBe(401);
    expect((await request(app).get("/metrics").set("Authorization", "Bearer otro-token-cualquiera-12345")).status).toBe(401);
  });

  it("expone métricas en formato Prometheus con el token correcto", async () => {
    const res = await request(app).get("/metrics").set("Authorization", "Bearer metrics-token-de-prueba-123456");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.text).toContain('moderation_queue_pending{domain="FORUM",kind="thread"} 4');
  });
});
