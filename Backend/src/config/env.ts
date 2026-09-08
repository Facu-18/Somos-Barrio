import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

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
  JWT_SECRET: z.string().min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().positive().default(30),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY:    z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
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
