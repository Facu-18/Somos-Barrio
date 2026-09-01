import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { redis } from "../../lib/redis";
import { asyncHandler } from "../../utils/async-handler";

const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "API funcionando",
    timestamp: new Date().toISOString()
  });
});

healthRouter.get("/live", (_req, res) => {
  res.json({ success: true, status: "alive", timestamp: new Date().toISOString() });
});

healthRouter.get("/ready", asyncHandler(async (_req, res) => {
  try {
    await Promise.all([prisma.$queryRaw`SELECT 1`, redis.ping()]);
    res.json({ success: true, status: "ready", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({
      success: false,
      status: "not_ready",
      message: "Dependencias no disponibles",
      timestamp: new Date().toISOString()
    });
  }
}));

export { healthRouter };
