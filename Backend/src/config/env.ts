import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const booleanFromEnv = z.preprocess(
  (value) => value === "true" ? true : value === "false" ? false : value,
  z.boolean()
);

const thresholdPair = z.object({ review: z.number().min(0).max(1), block: z.number().min(0).max(1) })
  .refine((value) => value.review < value.block, "review debe ser menor que block");
const defaultSightengineThresholds = {
  nudity: { review: 0.35, block: 0.7 }, sexual: { review: 0.35, block: 0.7 },
  violence: { review: 0.35, block: 0.7 }, gore: { review: 0.35, block: 0.7 },
  weapons: { review: 0.35, block: 0.7 }, drugs: { review: 0.35, block: 0.7 },
  alcohol: { review: 0.35, block: 0.7 }, tobacco: { review: 0.35, block: 0.7 },
  offensiveSymbols: { review: 0.35, block: 0.7 }
};
const sightengineThresholds = z.preprocess((value) => {
  if (value === undefined || value === "") return defaultSightengineThresholds;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}, z.object({
  nudity: thresholdPair, sexual: thresholdPair, violence: thresholdPair, gore: thresholdPair,
  weapons: thresholdPair, drugs: thresholdPair, alcohol: thresholdPair, tobacco: thresholdPair,
  offensiveSymbols: thresholdPair
}).strict());

export const parseSightengineThresholds = (value?: unknown) => sightengineThresholds.parse(value);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default("/api/v1"),
  CORS_ORIGIN: z.string().default("http://localhost:8081"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatoria"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  AI_PROVIDER_URL: z.string().url().default("http://localhost:1234/v1"),
  AI_API_KEY: z.string().default("lm-studio"),
  AI_MODEL: z.string().default("qwen2.5-7b-instruct-1m"),
  AI_DAILY_USER_LIMIT: z.coerce.number().int().nonnegative().default(3),
  AI_GLOBAL_DAILY_TOKEN_BUDGET: z.coerce.number().int().nonnegative().default(0),
  AI_MAX_CONCURRENCY: z.coerce.number().int().nonnegative().default(10),
  AI_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  AI_ENABLED: booleanFromEnv.default(true),
  AI_MAX_INPUT_TOKENS: z.coerce.number().int().positive().default(4000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(6000),
  AI_JSON_SCHEMA_ENABLED: booleanFromEnv.default(true),
  AI_QUOTA_TIMEZONE: z.string().default("America/Argentina/Buenos_Aires").refine((value) => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Zona horaria IANA inválida"),
  AI_COST_PER_1K_INPUT_TOKENS_USD: z.coerce.number().nonnegative().default(0),
  AI_COST_PER_1K_OUTPUT_TOKENS_USD: z.coerce.number().nonnegative().default(0),
  JWT_SECRET: z.string().min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().positive().default(30),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY:    z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  SIGHTENGINE_API_USER: z.string().optional(),
  SIGHTENGINE_API_SECRET: z.string().optional(),
  SIGHTENGINE_ENABLED: booleanFromEnv.default(false),
  SIGHTENGINE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(8000),
  SIGHTENGINE_THRESHOLDS: sightengineThresholds,
  MARKETPLACE_ASSET_CLEANUP_INTERVAL_MS: z.coerce.number().int().min(1000).default(3600000),
  MARKETPLACE_ASSET_ORPHAN_TTL_MS: z.coerce.number().int().min(60000).default(86400000),
  MARKETPLACE_REPORT_THRESHOLD: z.coerce.number().int().positive().default(3),
  MARKETPLACE_REPORT_WINDOW_MS: z.coerce.number().int().positive().default(3600000),
  MARKETPLACE_REPORT_USER_LIMIT: z.coerce.number().int().positive().default(10),
  MARKETPLACE_APPEAL_USER_LIMIT: z.coerce.number().int().positive().default(5),
  MARKETPLACE_ASSET_REVIEW_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  MARKETPLACE_ASSET_REVIEW_TTL_MS: z.coerce.number().int().positive().default(604800000),
  FORUM_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(3600000),
  FORUM_THREAD_USER_LIMIT: z.coerce.number().int().positive().default(5),
  FORUM_REPLY_USER_LIMIT: z.coerce.number().int().positive().default(30),
  FORUM_EDIT_USER_LIMIT: z.coerce.number().int().positive().default(20),
  FORUM_WRITE_IP_LIMIT: z.coerce.number().int().positive().default(150),
  FORUM_REPORT_THRESHOLD: z.coerce.number().int().positive().default(3),
  FORUM_REPORT_USER_LIMIT: z.coerce.number().int().positive().default(10),
  FORUM_APPEAL_USER_LIMIT: z.coerce.number().int().positive().default(5),
  EXPO_ACCESS_TOKEN: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
  NOTIFICATION_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).default(5000),
  NOTIFICATION_BATCH_SIZE: z.coerce.number().int().positive().max(100).default(25),
  NOTIFICATION_FETCH_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
}).superRefine((value, context) => {
  if (value.NODE_ENV === "production" && value.JWT_SECRET.includes("change_me")) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["JWT_SECRET"],
      message: "JWT_SECRET no puede usar el valor de ejemplo en produccion"
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
  throw new Error(`Variables de entorno invalidas:\n${formatted}`);
}

export const env = parsed.data;
