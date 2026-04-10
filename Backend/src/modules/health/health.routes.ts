import { Router } from "express";

const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "API funcionando",
    timestamp: new Date().toISOString()
  });
});

export { healthRouter };
