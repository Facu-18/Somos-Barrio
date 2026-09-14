import { createHash, randomUUID } from "node:crypto";
import { redis as defaultRedis } from "../../lib/redis";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { ApiError } from "../../utils/api-error";

export const AI_CODES = {
  disabled: "AI_DISABLED",
  limitsUnavailable: "AI_LIMITS_UNAVAILABLE",
  quotaExceeded: "AI_DAILY_QUOTA_EXCEEDED",
  userBusy: "AI_REQUEST_IN_PROGRESS",
  budgetExceeded: "AI_GLOBAL_BUDGET_EXCEEDED",
  concurrency: "AI_CONCURRENCY_LIMIT",
  providerUnreachable: "AI_PROVIDER_UNREACHABLE"
} as const;

export type AiUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  durationMs: number;
};

export type AiQuotaStatus = {
  enabled: boolean;
  dailyLimit: number;
  used: number;
  remaining: number;
  resetsAt: string;
  requestInProgress: boolean;
};

type LimiterRedis = {
  get(key: string): Promise<string | null>;
  exists(...keys: string[]): Promise<number>;
  set(key: string, value: string, px: "PX", ttl: number, nx: "NX"): Promise<"OK" | null>;
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
};

export type AiLimiterOptions = {
  enabled: boolean;
  dailyLimit: number;
  globalDailyTokenBudget: number;
  maxConcurrency: number;
  cacheTtlSeconds: number;
  timeZone: string;
  keyPrefix: string;
  // Tiempo máximo que un pedido idéntico espera al que está generando.
  singleFlightWaitMs: number;
  pollIntervalMs: number;
  // Duración de locks y leases; supera el timeout del proveedor para no liberar un pedido vivo.
  leaseMs: number;
  now: () => number;
};

type ExecuteParams = {
  operation: string;
  promptVersion: string;
  model: string;
  title: string;
  excerpt?: string | null;
  content: string;
  // Tokens de entrada estimados más el tope de salida: lo que se reserva del presupuesto.
  estimatedTokens: number;
};

export type AiExecution<T> = { result: T; cached: boolean; usage: AiUsage | null };

// Reserva todo o nada: lock del usuario, cuota diaria, presupuesto global y lugar de concurrencia.
const RESERVE_SCRIPT = `
local userLock, quotaKey, budgetKey, inflightKey = KEYS[1], KEYS[2], KEYS[3], KEYS[4]
local token, leaseMs, dailyLimit = ARGV[1], tonumber(ARGV[2]), tonumber(ARGV[3])
local budgetLimit, estimate, resetAt = tonumber(ARGV[4]), tonumber(ARGV[5]), tonumber(ARGV[6])
local maxConcurrency, nowMs = tonumber(ARGV[7]), tonumber(ARGV[8])

if redis.call('EXISTS', userLock) == 1 then return {'USER_BUSY', 0} end

local used = tonumber(redis.call('GET', quotaKey) or '0')
if used >= dailyLimit then return {'QUOTA_EXCEEDED', used} end

local spent = tonumber(redis.call('GET', budgetKey) or '0')
if budgetLimit > 0 and spent + estimate > budgetLimit then return {'BUDGET_EXCEEDED', used} end

if maxConcurrency > 0 then
  redis.call('ZREMRANGEBYSCORE', inflightKey, '-inf', nowMs)
  if redis.call('ZCARD', inflightKey) >= maxConcurrency then return {'CONCURRENCY', used} end
  redis.call('ZADD', inflightKey, nowMs + leaseMs, token)
  redis.call('PEXPIRE', inflightKey, leaseMs)
end

redis.call('SET', userLock, token, 'PX', leaseMs)
local newUsed = redis.call('INCR', quotaKey)
redis.call('EXPIREAT', quotaKey, resetAt)
redis.call('INCRBY', budgetKey, estimate)
redis.call('EXPIREAT', budgetKey, resetAt)
return {'OK', newUsed}
`;

// Cierra la reserva: ajusta presupuesto, devuelve cuota si corresponde, cachea y libera locks propios.
const SETTLE_SCRIPT = `
local userLock, quotaKey, budgetKey, inflightKey, flightKey, cacheKey = KEYS[1], KEYS[2], KEYS[3], KEYS[4], KEYS[5], KEYS[6]
local token, budgetDelta, refundQuota, cacheValue, cacheTtl = ARGV[1], tonumber(ARGV[2]), ARGV[3], ARGV[4], tonumber(ARGV[5])

if budgetDelta ~= 0 and redis.call('EXISTS', budgetKey) == 1 then
  local spent = redis.call('INCRBY', budgetKey, budgetDelta)
  if spent < 0 then redis.call('SET', budgetKey, 0, 'KEEPTTL') end
end
if refundQuota == '1' and tonumber(redis.call('GET', quotaKey) or '0') > 0 then
  redis.call('DECR', quotaKey)
end
if cacheValue ~= '' then
  redis.call('SET', cacheKey, cacheValue, 'EX', cacheTtl)
end
if redis.call('GET', userLock) == token then redis.call('DEL', userLock) end
if redis.call('GET', flightKey) == token then redis.call('DEL', flightKey) end
redis.call('ZREM', inflightKey, token)
return 1
`;

const RELEASE_FLIGHT_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Para la caché, espacios extra o saltos distintos no deben generar otra llamada al proveedor.
const normalizeForHash = (value: string | null | undefined) =>
  (value ?? "").normalize("NFC").replace(/\s+/g, " ").trim();

/**
 * Día de cuota en la zona horaria configurada y su próximo reinicio (medianoche local), en UTC.
 */
export function quotaWindow(nowMs: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date(nowMs)).map((part) => [part.type, part.value])
  );
  const localAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offsetMs = localAsUtc - Math.floor(nowMs / 1000) * 1000;
  const nextMidnightLocalAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day + 1);
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    resetsAtMs: nextMidnightLocalAsUtc - offsetMs
  };
}

export class AiLimiter {
  constructor(private readonly options: AiLimiterOptions, private readonly redis: LimiterRedis) {}

  private keys(userId: string, day: string) {
    const prefix = this.options.keyPrefix;
    return {
      userLock: `${prefix}inflight:user:${userId}`,
      quota: `${prefix}quota:${userId}:${day}`,
      budget: `${prefix}budget:${day}`,
      inflight: `${prefix}inflight:global`
    };
  }

  private unavailable(error: unknown): never {
    if (error instanceof ApiError) throw error;
    logger.error({ code: (error as NodeJS.ErrnoException)?.code }, "No se pudo verificar cuota o presupuesto de IA");
    throw new ApiError(503, "La asistencia de IA no está disponible en este momento. Intentá más tarde.", { code: AI_CODES.limitsUnavailable });
  }

  private assertEnabled() {
    if (!this.options.enabled) {
      throw new ApiError(503, "La asistencia de IA está desactivada temporalmente.", { code: AI_CODES.disabled });
    }
  }

  cacheKeyFor(params: Omit<ExecuteParams, "estimatedTokens">) {
    const hash = createHash("sha256").update(JSON.stringify({
      operation: params.operation,
      promptVersion: params.promptVersion,
      model: params.model,
      title: normalizeForHash(params.title),
      excerpt: normalizeForHash(params.excerpt),
      content: normalizeForHash(params.content)
    })).digest("hex");
    return { hash, cacheKey: `${this.options.keyPrefix}cache:${hash}`, flightKey: `${this.options.keyPrefix}flight:${hash}` };
  }

  async getQuotaStatus(userId: string): Promise<AiQuotaStatus> {
    const window = quotaWindow(this.options.now(), this.options.timeZone);
    const keys = this.keys(userId, window.day);
    try {
      const [usedRaw, busy] = await Promise.all([this.redis.get(keys.quota), this.redis.exists(keys.userLock)]);
      const used = Number(usedRaw ?? 0);
      return {
        enabled: this.options.enabled,
        dailyLimit: this.options.dailyLimit,
        used,
        remaining: Math.max(0, this.options.dailyLimit - used),
        resetsAt: new Date(window.resetsAtMs).toISOString(),
        requestInProgress: busy === 1
      };
    } catch (error) {
      this.unavailable(error);
    }
  }

  /**
   * Ejecuta una generación con caché, single-flight y reserva atómica de cuota y presupuesto.
   * Ante cualquier fallo de Redis antes de reservar se rechaza: nunca se llama al proveedor sin contabilizar.
   */
  async executeWithLimits<T>(
    userId: string,
    params: ExecuteParams,
    generate: () => Promise<{ result: T; usage: AiUsage | null }>
  ): Promise<AiExecution<T>> {
    this.assertEnabled();
    const { cacheKey, flightKey } = this.cacheKeyFor(params);
    const token = randomUUID();
    const deadline = this.options.now() + this.options.singleFlightWaitMs;

    // 1. Caché o liderazgo del vuelo: los pedidos idénticos esperan al primero sin gastar cuota.
    try {
      for (;;) {
        const cached = await this.redis.get(cacheKey);
        if (cached) return { result: JSON.parse(cached) as T, cached: true, usage: null };

        const leader = await this.redis.set(flightKey, token, "PX", this.options.leaseMs, "NX");
        if (leader) {
          // El líder anterior pudo cachear y soltar el lock entre nuestro GET y el SET: se vuelve a mirar.
          const cachedAfterLock = await this.redis.get(cacheKey);
          if (cachedAfterLock) {
            await this.releaseFlight(flightKey, token);
            return { result: JSON.parse(cachedAfterLock) as T, cached: true, usage: null };
          }
          break;
        }
        if (this.options.now() >= deadline) {
          throw new ApiError(429, "Ya se está generando una sugerencia para este contenido. Esperá unos segundos.", { code: AI_CODES.userBusy });
        }
        await sleep(this.options.pollIntervalMs);
      }
    } catch (error) {
      this.unavailable(error);
    }

    // 2. Reserva atómica antes de tocar el proveedor.
    const window = quotaWindow(this.options.now(), this.options.timeZone);
    const keys = this.keys(userId, window.day);
    const estimate = Math.max(1, Math.ceil(params.estimatedTokens));
    let reservation: [string, number];
    try {
      reservation = await this.redis.eval(
        RESERVE_SCRIPT, 4, keys.userLock, keys.quota, keys.budget, keys.inflight,
        token, this.options.leaseMs, this.options.dailyLimit, this.options.globalDailyTokenBudget,
        estimate, Math.ceil(window.resetsAtMs / 1000), this.options.maxConcurrency, this.options.now()
      ) as [string, number];
    } catch (error) {
      await this.releaseFlight(flightKey, token);
      this.unavailable(error);
    }

    if (reservation[0] !== "OK") {
      await this.releaseFlight(flightKey, token);
      this.rejectReservation(reservation[0], window.resetsAtMs);
    }

    // 3. Generación y cierre de la reserva con el uso real.
    let outcome: { result: T; usage: AiUsage | null };
    try {
      outcome = await generate();
    } catch (error) {
      // Solo se devuelve la cuota si el proveedor ni siquiera respondió; si respondió, pudo cobrar.
      const unreachable = error instanceof ApiError && (error.details as { code?: string } | undefined)?.code === AI_CODES.providerUnreachable;
      await this.settle(keys, flightKey, cacheKey, token, { budgetDelta: unreachable ? -estimate : 0, refundQuota: unreachable, cacheValue: "" });
      throw error;
    }

    const actual = outcome.usage?.totalTokens;
    // Sin `usage` del proveedor queda contabilizada la estimación completa.
    const budgetDelta = typeof actual === "number" && actual > 0 ? actual - estimate : 0;
    await this.settle(keys, flightKey, cacheKey, token, { budgetDelta, refundQuota: false, cacheValue: JSON.stringify(outcome.result) });
    return { result: outcome.result, cached: false, usage: outcome.usage };
  }

  private rejectReservation(code: string, resetsAtMs: number): never {
    const resetsAt = new Date(resetsAtMs).toISOString();
    if (code === "QUOTA_EXCEEDED") {
      throw new ApiError(429, "Alcanzaste el límite diario de mejoras con IA.", { code: AI_CODES.quotaExceeded, remaining: 0, resetsAt });
    }
    if (code === "USER_BUSY") {
      throw new ApiError(429, "Ya tenés una solicitud de IA en proceso. Esperá a que termine.", { code: AI_CODES.userBusy });
    }
    if (code === "BUDGET_EXCEEDED") {
      throw new ApiError(503, "La asistencia de IA está pausada por el uso de hoy. Volvé a intentar mañana.", { code: AI_CODES.budgetExceeded, resetsAt });
    }
    throw new ApiError(503, "Hay mucha demanda de IA en este momento. Intentá nuevamente en unos minutos.", { code: AI_CODES.concurrency });
  }

  private async releaseFlight(flightKey: string, token: string) {
    try {
      await this.redis.eval(RELEASE_FLIGHT_SCRIPT, 1, flightKey, token);
    } catch {
      // El lock vence solo por TTL.
    }
  }

  private async settle(
    keys: ReturnType<AiLimiter["keys"]>,
    flightKey: string,
    cacheKey: string,
    token: string,
    params: { budgetDelta: number; refundQuota: boolean; cacheValue: string }
  ) {
    try {
      await this.redis.eval(
        SETTLE_SCRIPT, 6, keys.userLock, keys.quota, keys.budget, keys.inflight, flightKey, cacheKey,
        token, Math.round(params.budgetDelta), params.refundQuota ? "1" : "0", params.cacheValue, this.options.cacheTtlSeconds
      );
    } catch (error) {
      // La reserva ya contabilizó cuota y presupuesto estimado; los locks vencen por TTL.
      logger.warn({ code: (error as NodeJS.ErrnoException)?.code }, "No se pudo cerrar la reserva de IA; queda la estimación contabilizada");
    }
  }
}

export const aiLimiter = new AiLimiter({
  enabled: env.AI_ENABLED,
  dailyLimit: env.AI_DAILY_USER_LIMIT,
  globalDailyTokenBudget: env.AI_GLOBAL_DAILY_TOKEN_BUDGET,
  maxConcurrency: env.AI_MAX_CONCURRENCY,
  cacheTtlSeconds: env.AI_CACHE_TTL_SECONDS,
  timeZone: env.AI_QUOTA_TIMEZONE,
  // Los tests comparten la Redis local: un prefijo propio evita sumar al presupuesto de desarrollo.
  keyPrefix: env.NODE_ENV === "test" ? "ai:test:" : "ai:",
  singleFlightWaitMs: 65_000,
  pollIntervalMs: 250,
  leaseMs: 90_000,
  now: () => Date.now()
}, defaultRedis as unknown as LimiterRedis);
