import rateLimit, { type Options, type Store } from "express-rate-limit";
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

type ForumWriteLimiterOptions = {
  code: string;
  message: string;
  limit: number;
  prefix: string;
  keyBy: "user" | "ip";
  windowMs?: number;
  store?: Store;
  skip?: Options["skip"];
};

// Contrato estable de 429 para el foro: mismo formato que el error-handler más un código.
export function createForumWriteLimiter(options: ForumWriteLimiterOptions) {
  return rateLimit({
    passOnStoreError: true,
    windowMs: options.windowMs ?? env.FORUM_RATE_LIMIT_WINDOW_MS,
    limit: options.limit,
    ...(options.keyBy === "user" ? { keyGenerator: (req) => req.user?.id ?? req.ip ?? "anonymous" } : {}),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: options.skip ?? (() => isTest),
    message: { success: false, message: options.message, details: { code: options.code } },
    store: options.store ?? new RedisStore({ sendCommand, prefix: options.prefix })
  });
}

export const forumThreadRateLimiter = createForumWriteLimiter({
  code: "FORUM_THREAD_RATE_LIMIT",
  message: "Alcanzaste el límite de hilos por hora. Intentá nuevamente más tarde.",
  limit: env.FORUM_THREAD_USER_LIMIT,
  prefix: "rl:forum-thread:",
  keyBy: "user"
});

export const forumReplyRateLimiter = createForumWriteLimiter({
  code: "FORUM_REPLY_RATE_LIMIT",
  message: "Alcanzaste el límite de respuestas por hora. Intentá nuevamente más tarde.",
  limit: env.FORUM_REPLY_USER_LIMIT,
  prefix: "rl:forum-reply:",
  keyBy: "user"
});

export const forumEditRateLimiter = createForumWriteLimiter({
  code: "FORUM_EDIT_RATE_LIMIT",
  message: "Alcanzaste el límite de ediciones por hora. Intentá nuevamente más tarde.",
  limit: env.FORUM_EDIT_USER_LIMIT,
  prefix: "rl:forum-edit:",
  keyBy: "user"
});

export const forumIpRateLimiter = createForumWriteLimiter({
  code: "FORUM_IP_RATE_LIMIT",
  message: "Demasiadas publicaciones desde esta red. Intentá nuevamente más tarde.",
  limit: env.FORUM_WRITE_IP_LIMIT,
  prefix: "rl:forum-ip:",
  keyBy: "ip"
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
