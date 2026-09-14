import pino, { DestinationStream, LoggerOptions } from "pino";
import { env } from "./env";
import { getRequestId } from "../lib/request-context";

const REDACTED = "[Redacted]";
const providerCredentialNames = new Set([
  "aiapikey",
  "jwtsecret",
  "databaseurl",
  "redisurl",
  "cloudinarycloudname",
  "cloudinaryapikey",
  "cloudinaryapisecret",
  "sightengineapiuser",
  "sightengineapisecret",
  "expoaccesstoken"
]);

const normalizeKey = (key: string): string => key.replace(/[^a-z0-9]/gi, "").toLowerCase();

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const sanitizeLogText = (value: string): string => {
  let sanitized = value
    .replace(/\bBearer\s+[^\s,;]+/gi, `Bearer ${REDACTED}`)
    .replace(/\b(Cookie|Set-Cookie)\s*[:=]\s*[^\r\n]+/gi, `$1: ${REDACTED}`)
    .replace(/([?&](?:api[_-]?secret|api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|secret)=)[^&#\s]+/gi, `$1${REDACTED}`)
    .replace(/\b(api[_-]?(?:secret|key|user)|access[_-]?token|refresh[_-]?token|jwt[_-]?secret|password|secret)\s*[:=]\s*[^\s,;]+/gi, `$1=${REDACTED}`);
  for (const [key, secret] of Object.entries(env)) {
    if (typeof secret === "string" && secret.length >= 4 && isSensitiveKey(key)) {
      sanitized = sanitized.replace(new RegExp(escapeRegExp(secret), "g"), REDACTED);
    }
  }
  return sanitized;
};

const isSensitiveKey = (key: string): boolean => {
  const normalized = normalizeKey(key);
  return providerCredentialNames.has(normalized)
    || normalized === "authorization"
    || normalized === "proxyauthorization"
    || normalized === "cookie"
    || normalized === "setcookie"
    || normalized === "email"
    || normalized === "phone"
    || normalized === "whatsapp"
    || normalized === "latitude"
    || normalized === "longitude"
    || normalized.endsWith("password")
    || normalized.endsWith("token")
    || normalized.endsWith("apikey")
    || normalized.endsWith("secret");
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const sanitizeError = (error: Error, includeDetails: boolean): Record<string, unknown> => {
  const candidate = error as Error & {
    code?: unknown;
    status?: unknown;
    response?: { status?: unknown };
    requestId?: unknown;
  };
  return {
    name: error.name,
    ...(typeof candidate.code === "string" ? { code: candidate.code } : {}),
    ...(typeof candidate.status === "number" ? { status: candidate.status } :
      typeof candidate.response?.status === "number" ? { status: candidate.response.status } : {}),
    ...(typeof candidate.requestId === "string" ? { requestId: candidate.requestId } : {}),
    ...(includeDetails ? { message: sanitizeLogText(error.message) } : {}),
    ...(includeDetails && typeof error.stack === "string" ? { stack: sanitizeLogText(error.stack) } : {})
  };
};

export const sanitizeLogValue = (value: unknown, includeErrorDetails = true): unknown => {
  const seen = new WeakSet<object>();

  const sanitize = (current: unknown, inRequest = false): unknown => {
    if (typeof current === "string") return sanitizeLogText(current);
    if (current instanceof Error) return sanitizeError(current, includeErrorDetails);
    if (Array.isArray(current)) {
      if (seen.has(current)) return "[Circular]";
      seen.add(current);
      return current.map((item) => sanitize(item, inRequest));
    }
    if (!isPlainObject(current)) return current;
    if (seen.has(current)) return "[Circular]";
    seen.add(current);

    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(current)) {
      const normalized = normalizeKey(key);
      if (inRequest && (normalized === "body" || normalized === "rawbody")) continue;
      result[key] = isSensitiveKey(key)
        ? REDACTED
        : sanitize(item, inRequest || normalized === "req" || normalized === "request");
    }
    return result;
  };

  return sanitize(value);
};

export const createLogger = (
  nodeEnv: "development" | "test" | "production" = env.NODE_ENV,
  destination?: DestinationStream
) => {
  const options: LoggerOptions = {
    level: nodeEnv === "development" ? "debug" : "info",
    // Correlación: cualquier log emitido dentro de una request incluye su id opaco.
    mixin() {
      const requestId = getRequestId();
      return requestId ? { requestId } : {};
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.Authorization",
        "req.headers.cookie",
        "req.headers.Cookie",
        "req.body",
        "res.headers['set-cookie']",
        "res.headers['Set-Cookie']"
      ],
      censor: REDACTED
    },
    hooks: {
      logMethod(args, method) {
        method.apply(this, args.map((arg) => sanitizeLogValue(arg, nodeEnv !== "production")) as Parameters<typeof method>);
      }
    },
    transport: nodeEnv === "development" && !destination
      ? {
          target: "pino-pretty",
          options: { colorize: true, singleLine: true }
        }
      : undefined
  };

  return destination ? pino(options, destination) : pino(options);
};

export const logger = createLogger();
