import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/redis", () => ({ redis: {} }));

import { env } from "../../config/env";
import { evaluateAlerts } from "./metrics.service";

const quiet = { automatedBlocksLastHour: 0, providerRateLimitedLast15Min: 0, totalPending: 0, oldestPendingHours: 0, budgetRatio: null };

describe("alertas de moderación", () => {
  it("no alerta en condiciones normales", () => {
    expect(evaluateAlerts(quiet)).toEqual([]);
  });

  it.each([
    ["AUTOMATED_BLOCK_SPIKE", { automatedBlocksLastHour: env.ALERT_AUTOMATED_BLOCKS_PER_HOUR }],
    ["AI_PROVIDER_RATE_LIMITED", { providerRateLimitedLast15Min: env.ALERT_AI_PROVIDER_429_PER_15_MIN }],
    ["QUEUE_BACKLOG", { totalPending: env.ALERT_QUEUE_BACKLOG }],
    ["QUEUE_STALE", { oldestPendingHours: env.ALERT_QUEUE_OLDEST_HOURS }],
    ["AI_BUDGET_NEAR_LIMIT", { budgetRatio: env.ALERT_AI_BUDGET_RATIO }]
  ])("dispara %s al llegar al umbral", (code, overrides) => {
    const alerts = evaluateAlerts({ ...quiet, ...overrides });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ code, severity: "warning" });
  });

  it("escala a crítica una cola del doble del umbral y el presupuesto agotado", () => {
    const alerts = evaluateAlerts({ ...quiet, totalPending: env.ALERT_QUEUE_BACKLOG * 2, budgetRatio: 1 });
    expect(alerts.map((alert) => [alert.code, alert.severity])).toEqual([
      ["QUEUE_BACKLOG", "critical"],
      ["AI_BUDGET_NEAR_LIMIT", "critical"]
    ]);
  });

  it("sin presupuesto configurado no alerta por presupuesto", () => {
    expect(evaluateAlerts({ ...quiet, budgetRatio: null })).toEqual([]);
  });
});
