import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { ApiError } from "../utils/api-error";

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      details: error.details ?? null
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Error de validacion",
      details: error.flatten()
    });
    return;
  }

  logger.error({ error }, "Error no controlado");

  res.status(500).json({
    success: false,
    message: "Error interno del servidor",
    details: env.NODE_ENV === "development" ? error : null
  });
};
