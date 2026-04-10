import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { apiRouter } from "./routes";
import { errorHandler } from "./middlewares/error-handler";
import { notFoundHandler } from "./middlewares/not-found";
import { globalRateLimiter } from "./middlewares/rate-limit";

export const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(globalRateLimiter);
app.use(
  pinoHttp({
    logger
  })
);

if (env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Somos Barrio API"
  });
});

app.use(env.API_PREFIX, apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
