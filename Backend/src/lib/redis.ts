import Redis from "ioredis";
import { env } from "../config/env";
import { logger } from "../config/logger";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  retryStrategy: (times) => {
    if (times > 10) return null; // deja de reintentar después de 10 intentos
    return Math.min(times * 200, 3000);
  }
});

redis.on("connect", () => logger.info("Redis conectado"));
redis.on("error", (error) =>
  logger.warn({ code: (error as NodeJS.ErrnoException).code }, "Redis no disponible")
);
