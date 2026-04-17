import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { env } from "../config/env";
import { redis } from "../lib/redis";

type RedisReply = boolean | number | string | (boolean | number | string)[];

// Si Redis no está disponible, sendCommand devuelve 0 y el rate-limiter
// falla abierto (permite el request) en lugar de crashear el servidor.
const sendCommand = async (...args: string[]): Promise<RedisReply> => {
  try {
    return (await redis.call(args[0], ...args.slice(1))) as RedisReply;
  } catch {
    return 0;
  }
};

const isTest = env.NODE_ENV === "test";

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    success: false,
    message: "Demasiadas solicitudes, intenta nuevamente en unos minutos."
  },
  store: new RedisStore({ sendCommand })
});

export const authRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: env.NODE_ENV === "production" ? 10 : 50,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    success: false,
    message: "Demasiados intentos de autenticacion, espera unos minutos."
  },
  store: new RedisStore({ sendCommand })
});
