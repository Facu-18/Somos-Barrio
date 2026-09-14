import { timingSafeEqual } from "node:crypto";
import { NextFunction, Request, Response, Router } from "express";
import { env } from "../../config/env";
import { metrics } from "../../lib/metrics";
import { asyncHandler } from "../../utils/async-handler";
import { metricsService } from "./metrics.service";

export const metricsRouter = Router();

// Exposición para Prometheus. Sin METRICS_TOKEN el endpoint no existe; con token exige Bearer.
function requireMetricsToken(req: Request, res: Response, next: NextFunction) {
  if (!env.METRICS_TOKEN) {
    res.status(404).json({ success: false, message: "Ruta no encontrada", details: null });
    return;
  }
  const header = req.headers.authorization ?? "";
  const provided = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
  const expected = Buffer.from(env.METRICS_TOKEN);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    res.status(401).json({ success: false, message: "No autenticado", details: null });
    return;
  }
  next();
}

metricsRouter.get(
  "/",
  requireMetricsToken,
  asyncHandler(async (_req: Request, res: Response) => {
    const gauges = await metricsService.prometheusGauges();
    res.type("text/plain; version=0.0.4").send(metrics.renderPrometheus(gauges));
  })
);
