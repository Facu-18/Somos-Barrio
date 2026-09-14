import { describe, it, expect, vi } from "vitest";

vi.mock("../../lib/redis", () => ({ redis: {} }));
vi.mock("../../config/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { AI_CODES, AiLimiter } from "./ai.limiter";
import { ApiError } from "../../utils/api-error";

const options = {
  enabled: true,
  dailyLimit: 3,
  globalDailyTokenBudget: 1_000,
  maxConcurrency: 5,
  cacheTtlSeconds: 60,
  timeZone: "America/Argentina/Buenos_Aires",
  keyPrefix: "ai:unit:",
  singleFlightWaitMs: 100,
  pollIntervalMs: 10,
  leaseMs: 1_000,
  now: () => Date.now()
};

const request = { operation: "improve", promptVersion: "v", model: "m", title: "t", content: "c", estimatedTokens: 50 };
const redisDown = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });

// Redis en memoria mínimo, con fallas inyectables por operación.
function fakeRedis(fail: { get?: boolean; set?: boolean; reserve?: boolean; settle?: boolean } = {}) {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn(async (key: string) => {
      if (fail.get) throw redisDown;
      return store.get(key) ?? null;
    }),
    exists: vi.fn(async () => 0),
    set: vi.fn(async (key: string, value: string) => {
      if (fail.set) throw redisDown;
      if (store.has(key)) return null;
      store.set(key, value);
      return "OK" as const;
    }),
    eval: vi.fn(async (script: string, _numKeys: number, ...args: (string | number)[]) => {
      if (script.includes("RESERVE") || script.includes("dailyLimit")) {
        if (fail.reserve) throw redisDown;
        return ["OK", 1];
      }
      if (script.includes("cacheValue")) {
        if (fail.settle) throw redisDown;
        return 1;
      }
      store.delete(String(args[0]));
      return 1;
    })
  };
}

const expectFailClosed = async (promise: Promise<unknown>) => {
  await expect(promise).rejects.toBeInstanceOf(ApiError);
  await expect(promise).rejects.toMatchObject({ statusCode: 503, details: { code: AI_CODES.limitsUnavailable } });
};

describe("AiLimiter — degradación", () => {
  it.each([
    ["no puede leer la caché", { get: true }],
    ["no puede tomar el lock de single-flight", { set: true }],
    ["no puede reservar cuota y presupuesto", { reserve: true }]
  ])("falla cerrado si Redis %s y nunca llama al proveedor", async (_case, failure) => {
    const redis = fakeRedis(failure);
    const limiter = new AiLimiter(options, redis);
    const generate = vi.fn(async () => ({ result: "x", usage: null }));

    await expectFailClosed(limiter.executeWithLimits("user", request, generate));
    expect(generate).not.toHaveBeenCalled();
  });

  it("si Redis cae después de generar, devuelve el resultado con la reserva ya contabilizada", async () => {
    const redis = fakeRedis({ settle: true });
    const limiter = new AiLimiter(options, redis);
    const generate = vi.fn(async () => ({ result: { summary: "ok" }, usage: null }));

    await expect(limiter.executeWithLimits("user", request, generate)).resolves.toMatchObject({ result: { summary: "ok" }, cached: false });
    // La reserva (cuota + estimación) se hizo antes de llamar al proveedor.
    expect(redis.eval.mock.calls[0][0]).toContain("INCRBY");
  });

  it("libera el lock de single-flight si la reserva es rechazada", async () => {
    const redis = fakeRedis();
    redis.eval.mockImplementationOnce(async () => ["QUOTA_EXCEEDED", 3]);
    const limiter = new AiLimiter(options, redis);

    await expect(limiter.executeWithLimits("user", request, vi.fn())).rejects.toMatchObject({
      statusCode: 429,
      details: { code: AI_CODES.quotaExceeded, remaining: 0, resetsAt: expect.any(String) }
    });
    expect([...redis.store.keys()].some((key) => key.includes("flight"))).toBe(false);
  });

  it("falla cerrado al consultar la cuota con Redis caído", async () => {
    const redis = fakeRedis({ get: true });
    await expectFailClosed(new AiLimiter(options, redis).getQuotaStatus("user"));
  });

  it("un pedido idéntico que espera demasiado recibe 429 sin generar", async () => {
    const redis = fakeRedis();
    const limiter = new AiLimiter(options, redis);
    const { flightKey } = limiter.cacheKeyFor(request);
    redis.store.set(flightKey, "otro-pedido");
    const generate = vi.fn();

    await expect(limiter.executeWithLimits("user", request, generate)).rejects.toMatchObject({
      statusCode: 429,
      details: { code: AI_CODES.userBusy }
    });
    expect(generate).not.toHaveBeenCalled();
  });
});
