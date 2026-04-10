import Redis from "ioredis";
import { env } from "../config/env";
import { logger } from "../config/logger";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

redis.on("connect", () => logger.info("Redis conectado"));
redis.on("error", (error) => logger.error({ error }, "Error en Redis"));
