import { describe, it, expect, afterAll, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { redis } from "../../lib/redis";
import { AI_CODES, AiLimiter, AiLimiterOptions, AiUsage, quotaWindow } from "./ai.limiter";
import { ApiError } from "../../utils/api-error";

// Redis real con un prefijo propio por limiter: los tests no comparten claves ni pisan datos de desarrollo.
const prefixes: string[] = [];
const createLimiter = (overrides: Partial<AiLimiterOptions> = {}) => {
  const keyPrefix = `ai:test:${randomUUID()}:`;
  prefixes.push(keyPrefix);
  return new AiLimiter({
    enabled: true,
    dailyLimit: 3,
    globalDailyTokenBudget: 0,
    maxConcurrency: 10,
    cacheTtlSeconds: 60,
    timeZone: "America/Argentina/Buenos_Aires",
    keyPrefix,
    singleFlightWaitMs: 5_000,
    pollIntervalMs: 20,
    leaseMs: 10_000,
    now: () => Date.now(),
    ...overrides
  }, redis as never);
};

let contentCounter = 0;
const params = (overrides: Partial<{ content: string; estimatedTokens: number; operation: string }> = {}) => ({
  operation: "improve",
  promptVersion: "test-1",
  model: "test-model",
  title: "Corte de agua",
  excerpt: null,
  content: `Contenido ${contentCounter += 1}`,
  estimatedTokens: 100,
  ...overrides
});

const usage = (totalTokens: number | null): AiUsage => ({ promptTokens: null, completionTokens: null, totalTokens, durationMs: 5 });
const generator = (result: unknown = { summary: "ok" }, totalTokens: number | null = 50, delayMs = 0) =>
  vi.fn(async () => {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    return { result, usage: usage(totalTokens) };
  });

const errorCode = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return { status: (error as ApiError).statusCode, code: ((error as ApiError).details as { code?: string } | undefined)?.code };
  }
  return null;
};

afterAll(async () => {
  for (const prefix of prefixes) {
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length) await redis.del(...keys);
  }
});

describe("AiLimiter — Redis", () => {
  describe("cuota diaria", () => {
    it("la cuarta generación del día devuelve 429 sin llamar al proveedor", async () => {
      const limiter = createLimiter();
      for (let index = 0; index < 3; index += 1) {
        await limiter.executeWithLimits("user-quota", params(), generator());
      }

      const fourth = generator();
      expect(await errorCode(limiter.executeWithLimits("user-quota", params(), fourth)))
        .toEqual({ status: 429, code: AI_CODES.quotaExceeded });
      expect(fourth).not.toHaveBeenCalled();
      expect(await limiter.getQuotaStatus("user-quota")).toMatchObject({ used: 3, remaining: 0, dailyLimit: 3, requestInProgress: false });
    });

    it("la cuota es por usuario", async () => {
      const limiter = createLimiter({ dailyLimit: 1 });
      await limiter.executeWithLimits("user-a", params(), generator());
      await expect(limiter.executeWithLimits("user-b", params(), generator())).resolves.toMatchObject({ cached: false });
    });

    it("informa el próximo reinicio a medianoche de Buenos Aires", async () => {
      const now = Date.UTC(2026, 8, 13, 23, 30); // 20:30 en Argentina (UTC-3)
      expect(quotaWindow(now, "America/Argentina/Buenos_Aires")).toEqual({
        day: "2026-09-13",
        resetsAtMs: Date.UTC(2026, 8, 14, 3, 0)
      });
      // 01:00 UTC ya es el día siguiente en UTC, pero todavía el 13 en Argentina.
      expect(quotaWindow(Date.UTC(2026, 8, 14, 1, 0), "America/Argentina/Buenos_Aires").day).toBe("2026-09-13");
    });

    it("devuelve la cuota si el proveedor no era alcanzable", async () => {
      const limiter = createLimiter();
      const unreachable = vi.fn(async () => {
        throw new ApiError(502, "sin conexión", { code: AI_CODES.providerUnreachable });
      });
      await expect(limiter.executeWithLimits("user-refund", params(), unreachable)).rejects.toBeInstanceOf(ApiError);
      expect((await limiter.getQuotaStatus("user-refund")).used).toBe(0);
    });

    it("mantiene la cuota consumida si el proveedor respondió con una salida inválida", async () => {
      const limiter = createLimiter();
      const invalid = vi.fn(async () => {
        throw new ApiError(502, "salida inválida", { code: "AI_OUTPUT_INVALID" });
      });
      await expect(limiter.executeWithLimits("user-invalid", params(), invalid)).rejects.toBeInstanceOf(ApiError);
      expect((await limiter.getQuotaStatus("user-invalid")).used).toBe(1);
    });
  });

  describe("caché", () => {
    it("repetir exactamente el contenido usa caché sin cuota ni proveedor", async () => {
      const limiter = createLimiter({ dailyLimit: 1 });
      const request = params();
      const first = generator({ summary: "original" });
      await limiter.executeWithLimits("user-cache", request, first);

      const second = generator({ summary: "no debería generarse" });
      const cached = await limiter.executeWithLimits("user-cache", request, second);

      expect(cached).toEqual({ result: { summary: "original" }, cached: true, usage: null });
      expect(second).not.toHaveBeenCalled();
      expect((await limiter.getQuotaStatus("user-cache")).used).toBe(1);
    });

    it("normaliza espacios pero distingue modelo, versión de prompt y operación", async () => {
      const limiter = createLimiter();
      const base = params();
      expect(limiter.cacheKeyFor({ ...base, content: `  ${base.content.replace(" ", "\n\n ")}  ` }).hash)
        .toBe(limiter.cacheKeyFor(base).hash);
      expect(limiter.cacheKeyFor({ ...base, model: "otro" }).hash).not.toBe(limiter.cacheKeyFor(base).hash);
      expect(limiter.cacheKeyFor({ ...base, promptVersion: "test-2" }).hash).not.toBe(limiter.cacheKeyFor(base).hash);
      expect(limiter.cacheKeyFor({ ...base, operation: "summarize" }).hash).not.toBe(limiter.cacheKeyFor(base).hash);
    });
  });

  describe("concurrencia", () => {
    it("dos taps simultáneos del mismo contenido generan una sola llamada", async () => {
      const limiter = createLimiter();
      const request = params();
      const generate = generator({ summary: "compartido" }, 50, 150);

      const [first, second] = await Promise.all([
        limiter.executeWithLimits("user-taps", request, generate),
        limiter.executeWithLimits("user-taps", request, generate)
      ]);

      expect(generate).toHaveBeenCalledTimes(1);
      expect(first.result).toEqual(second.result);
      expect([first.cached, second.cached].sort()).toEqual([false, true]);
      expect((await limiter.getQuotaStatus("user-taps")).used).toBe(1);
    });

    it("dos dispositivos de distintos usuarios con el mismo contenido comparten la llamada", async () => {
      const limiter = createLimiter();
      const request = params();
      const generate = generator({ summary: "compartido" }, 50, 150);

      await Promise.all([
        limiter.executeWithLimits("device-a", request, generate),
        limiter.executeWithLimits("device-b", request, generate)
      ]);
      expect(generate).toHaveBeenCalledTimes(1);
    });

    it("permite una sola llamada en vuelo por usuario para contenidos distintos", async () => {
      const limiter = createLimiter();
      const slow = generator({ summary: "lento" }, 50, 200);
      const pending = limiter.executeWithLimits("user-busy", params(), slow);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect((await limiter.getQuotaStatus("user-busy")).requestInProgress).toBe(true);
      const other = generator();
      expect(await errorCode(limiter.executeWithLimits("user-busy", params(), other)))
        .toEqual({ status: 429, code: AI_CODES.userBusy });
      expect(other).not.toHaveBeenCalled();
      await pending;
      expect((await limiter.getQuotaStatus("user-busy")).requestInProgress).toBe(false);
    });

    it("respeta la concurrencia máxima global", async () => {
      const limiter = createLimiter({ maxConcurrency: 1 });
      const pending = limiter.executeWithLimits("global-a", params(), generator({ summary: "a" }, 50, 200));
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(await errorCode(limiter.executeWithLimits("global-b", params(), generator())))
        .toEqual({ status: 503, code: AI_CODES.concurrency });
      await pending;
      await expect(limiter.executeWithLimits("global-b", params(), generator())).resolves.toMatchObject({ cached: false });
    });
  });

  describe("presupuesto global", () => {
    it("alcanzar el presupuesto corta nuevas generaciones", async () => {
      const limiter = createLimiter({ globalDailyTokenBudget: 250, dailyLimit: 10 });
      await limiter.executeWithLimits("budget-a", params({ estimatedTokens: 200 }), generator({ summary: "ok" }, 200));

      const blocked = generator();
      expect(await errorCode(limiter.executeWithLimits("budget-b", params({ estimatedTokens: 100 }), blocked)))
        .toEqual({ status: 503, code: AI_CODES.budgetExceeded });
      expect(blocked).not.toHaveBeenCalled();
    });

    it("reserva antes de generar: llamadas concurrentes no sobrepasan el presupuesto", async () => {
      const limiter = createLimiter({ globalDailyTokenBudget: 1_000, dailyLimit: 10 });
      const generate = generator({ summary: "ok" }, 600, 150);

      const results = await Promise.allSettled([
        limiter.executeWithLimits("race-a", params({ estimatedTokens: 600 }), generate),
        limiter.executeWithLimits("race-b", params({ estimatedTokens: 600 }), generate)
      ]);

      expect(generate).toHaveBeenCalledTimes(1);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    });

    it("ajusta la reserva al uso real y conserva la estimación si no hay usage", async () => {
      const limiter = createLimiter({ globalDailyTokenBudget: 1_000, dailyLimit: 10 });
      const budgetKey = `${prefixes.at(-1)}budget:${quotaWindow(Date.now(), "America/Argentina/Buenos_Aires").day}`;

      await limiter.executeWithLimits("adjust-a", params({ estimatedTokens: 500 }), generator({ summary: "ok" }, 120));
      expect(await redis.get(budgetKey)).toBe("120");

      await limiter.executeWithLimits("adjust-b", params({ estimatedTokens: 300 }), generator({ summary: "ok" }, null));
      expect(await redis.get(budgetKey)).toBe("420");
    });
  });

  it("AI_ENABLED=false corta todo antes de tocar Redis o el proveedor", async () => {
    const limiter = createLimiter({ enabled: false });
    const generate = generator();
    expect(await errorCode(limiter.executeWithLimits("user-off", params(), generate))).toEqual({ status: 503, code: AI_CODES.disabled });
    expect(generate).not.toHaveBeenCalled();
  });
});
