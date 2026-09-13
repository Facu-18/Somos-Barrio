import { redis } from "../../lib/redis";
import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import crypto from "crypto";

export class AiLimiter {
  private static readonly DAILY_LIMIT = env.AI_DAILY_USER_LIMIT;
  private static readonly GLOBAL_BUDGET = env.AI_GLOBAL_DAILY_TOKEN_BUDGET;
  private static readonly MAX_CONCURRENCY = env.AI_MAX_CONCURRENCY;

  /**
   * Ejecuta una generación de IA controlando concurrencia por usuario,
   * presupuesto global, cuota diaria por usuario y devolviendo
   * un resultado cacheado si es idéntico.
   */
  static async executeWithLimits<T>(
    userId: string,
    promptParams: { title: string; excerpt?: string | null; content: string; operation: string; promptVersion: string },
    generateFn: () => Promise<{ result: T; tokens: number }>
  ): Promise<T> {
    if (!env.AI_ENABLED) {
      throw new ApiError(503, "La asistencia de IA está desactivada temporalmente.");
    }

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const userQuotaKey = `ai:quota:${userId}:${today}`;
    const globalBudgetKey = `ai:budget:${today}`;
    const userLockKey = `ai:lock:${userId}`;

    // 1. Hash de los parámetros para caché
    const hashPayload = JSON.stringify({
      operation: promptParams.operation,
      // Un cambio de prompt o de contrato de salida no puede servir resultados viejos de la caché.
      promptVersion: promptParams.promptVersion,
      model: env.AI_MODEL,
      title: promptParams.title,
      excerpt: promptParams.excerpt,
      content: promptParams.content
    });
    const hash = crypto.createHash("sha256").update(hashPayload).digest("hex");
    const cacheKey = `ai:cache:${hash}`;

    // Intentar leer de caché (no consume tokens ni cuota)
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as T;
    } catch {
      // Ignorar fallos de redis al leer
    }

    // 2. Lock de concurrencia
    const lockAcquired = await redis.set(userLockKey, "1", "EX", 120, "NX");
    if (!lockAcquired) {
      throw new ApiError(429, "Ya tienes una solicitud de IA en proceso. Espera a que termine.");
    }

    try {
      // 3. Chequear cuota diaria del usuario
      const currentQuotaStr = await redis.get(userQuotaKey);
      const currentQuota = currentQuotaStr ? parseInt(currentQuotaStr, 10) : 0;
      if (currentQuota >= this.DAILY_LIMIT) {
        throw new ApiError(429, "Has alcanzado el límite diario de mejoras con IA.");
      }

      // 4. Chequear presupuesto global
      if (this.GLOBAL_BUDGET > 0) {
        const currentBudgetStr = await redis.get(globalBudgetKey);
        const currentBudget = currentBudgetStr ? parseInt(currentBudgetStr, 10) : 0;
        if (currentBudget >= this.GLOBAL_BUDGET) {
          throw new ApiError(503, "El servicio de IA se encuentra pausado por exceso de uso global en el día.");
        }
      }

      // 5. Verificar concurrencia global (opcional simple, podría ser con lista/set)
      // (Saltado por complejidad si no se requiere estricto, la consigna pedía concurrencia máxima global pero el foco es budget/cuota.
      // Implementaremos un contador global simple).
      const globalConcurrencyKey = `ai:concurrency`;
      const activeRequests = await redis.incr(globalConcurrencyKey);
      await redis.expire(globalConcurrencyKey, 120); // safety expire
      if (this.MAX_CONCURRENCY > 0 && activeRequests > this.MAX_CONCURRENCY) {
        await redis.decr(globalConcurrencyKey);
        throw new ApiError(503, "Hay demasiada demanda de IA en este momento, intenta nuevamente en unos minutos.");
      }

      try {
        // Ejecutar la petición real
        const { result, tokens } = await generateFn();

        // 6. Contabilizar
        await redis.incr(userQuotaKey);
        await redis.expire(userQuotaKey, 86400); // 24h

        if (this.GLOBAL_BUDGET > 0 && tokens > 0) {
          await redis.incrby(globalBudgetKey, tokens);
          await redis.expire(globalBudgetKey, 86400); // 24h
        }

        // 7. Cachear el resultado
        try {
          await redis.setex(cacheKey, env.AI_CACHE_TTL_SECONDS, JSON.stringify(result));
        } catch { /* ignorar fallo de guardado en cache */ }

        return result;
      } finally {
        await redis.decr(globalConcurrencyKey);
      }
    } finally {
      // Liberar el lock de concurrencia del usuario
      await redis.del(userLockKey);
    }
  }
}
