import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp, { stdSerializers } from "pino-http";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { apiRouter } from "./routes";
import { errorHandler } from "./middlewares/error-handler";
import { notFoundHandler } from "./middlewares/not-found";
import { globalRateLimiter } from "./middlewares/rate-limit";
import { openapiSpec } from "./lib/openapi";
import { requestContext } from "./lib/request-context";
import { metricsRouter } from "./modules/metrics/metrics.routes";

export const app = express();

app.set("trust proxy", 1);
// Primero: todo lo que se loguea durante la request lleva el mismo requestId.
app.use(requestContext);
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = env.CORS_ORIGIN.split(",").map((value) => value.trim());
      callback(null, !origin || allowedOrigins.includes(origin));
    },
    credentials: true,
    exposedHeaders: ["X-Request-Id"]
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => (req as typeof req & { id: string }).id,
    serializers: {
      req: (req) => {
        const sanitizedReq = stdSerializers.req(req) as any;
        delete sanitizedReq.body;
        return sanitizedReq;
      },
      res: stdSerializers.res,
      err: stdSerializers.err,
    }
  })
);
// Prometheus scrapea sin pasar por el rate limiter global; el endpoint exige METRICS_TOKEN.
app.use("/metrics", metricsRouter);
app.use(globalRateLimiter);

app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, { customSiteTitle: "Somos Barrio API Docs" })
);

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Somos Barrio API"
  });
});

app.use(env.API_PREFIX, apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
