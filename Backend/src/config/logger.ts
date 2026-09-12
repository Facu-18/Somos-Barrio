import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.NODE_ENV === "development" ? "debug" : "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "err.config.headers.Authorization",
      "err.config.headers.authorization",
      "password",
      "passwordConfirm",
      "token",
      "accessToken",
      "refreshToken",
      "pushToken",
      "email",
      "phone",
      "whatsapp",
      "latitude",
      "longitude",
      "AI_API_KEY",
      "*.password",
      "*.passwordConfirm",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
      "*.pushToken",
      "*.email",
      "*.phone",
      "*.whatsapp",
      "*.latitude",
      "*.longitude",
      "*.AI_API_KEY"
    ],
    censor: "[Redacted]"
  },
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            singleLine: true
          }
        }
      : undefined
});
