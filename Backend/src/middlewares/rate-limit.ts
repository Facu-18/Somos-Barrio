import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { env } from "../config/env";
import { redis } from "../lib/redis";

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Demasiadas solicitudes, intenta nuevamente en unos minutos."
  },
  store: new RedisStore({
    // rate-limit-redis espera un arreglo de strings y devuelve una Promise.
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as Promise<any>
  })
});

export const authRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: env.NODE_ENV === "production" ? 10 : 50,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Demasiados intentos de autenticacion, espera unos minutos."
  },
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as Promise<any>
  })
});
