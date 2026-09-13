import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { env } from "../config/env";
import { redis } from "../lib/redis";

type RedisReply = boolean | number | string | (boolean | number | string)[];

const sendCommand = async (...args: string[]): Promise<RedisReply> => {
  return (await redis.call(args[0], ...args.slice(1))) as RedisReply;
};

const isTest = env.NODE_ENV === "test";

export const globalRateLimiter = rateLimit({
  passOnStoreError: true,
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === "production" ? 200 : 2000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => isTest || req.originalUrl.startsWith(`${env.API_PREFIX}/health`),
  message: {
    success: false,
    message: "Demasiadas solicitudes, intenta nuevamente en unos minutos."
  },
  store: new RedisStore({ sendCommand })
});

export const authRateLimiter = rateLimit({
  passOnStoreError: true,
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

export const uploadRateLimiter = rateLimit({
  passOnStoreError: true,
  windowMs: 60 * 60 * 1000,
  limit: env.NODE_ENV === "production" ? 20 : 100,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? "anonymous",
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    success: false,
    message: "Alcanzaste el limite de imagenes por hora."
  },
  store: new RedisStore({ sendCommand, prefix: "rl:upload:" })
});

export const marketplaceReportRateLimiter = rateLimit({
  passOnStoreError: true,
  windowMs: env.MARKETPLACE_REPORT_WINDOW_MS,
  limit: env.MARKETPLACE_REPORT_USER_LIMIT,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? "anonymous",
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => isTest,
  message: { success: false, message: "Alcanzaste el límite de reportes. Intentá nuevamente más tarde." },
  store: new RedisStore({ sendCommand, prefix: "rl:marketplace-report:" })
});

export const marketplaceAppealRateLimiter = rateLimit({
  passOnStoreError: true,
  windowMs: env.MARKETPLACE_REPORT_WINDOW_MS,
  limit: env.MARKETPLACE_APPEAL_USER_LIMIT,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? "anonymous",
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => isTest,
  message: { success: false, message: "Alcanzaste el límite de apelaciones. Intentá nuevamente más tarde." },
  store: new RedisStore({ sendCommand, prefix: "rl:marketplace-appeal:" })
});

export const deviceCleanupRateLimiter = rateLimit({
  passOnStoreError: true,
  windowMs: 60 * 60 * 1000,
  limit: env.NODE_ENV === "production" ? 30 : 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    success: false,
    message: "Demasiados intentos de limpieza de dispositivos."
  },
  store: new RedisStore({ sendCommand, prefix: "rl:device-cleanup:" })
});
