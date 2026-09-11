import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import multer from "multer";
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

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const statusByCode: Record<string, number> = {
      P2002: 409,
      P2003: 409,
      P2025: 404
    };
    const status = statusByCode[error.code];
    if (status) {
      res.status(status).json({
        success: false,
        message: status === 404 ? "Recurso no encontrado" : "Conflicto con datos existentes",
        details: { code: error.code }
      });
      return;
    }
  }

  if (error instanceof multer.MulterError) {
    res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      success: false,
      message: error.code === "LIMIT_FILE_SIZE" ? "El archivo supera el limite permitido" : "Archivo invalido",
      details: { code: error.code }
    });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ success: false, message: "JSON invalido", details: null });
    return;
  }

  let sanitizedError: unknown = error;
  // axios may not be available as a global, but we can check properties if we don't want to import it,
  // or just import axios. I'll import axios at the top if needed, but it's simpler to duck type:
  if (error && typeof error === 'object' && 'isAxiosError' in error && error.isAxiosError) {
    const axiosErr = error as any;
    sanitizedError = {
      message: axiosErr.message,
      code: axiosErr.code,
      status: axiosErr.response?.status,
      name: axiosErr.name,
      stack: axiosErr.stack
    };
  } else if (error instanceof Error) {
    sanitizedError = {
      message: error.message,
      name: error.name,
      stack: error.stack
    };
  } else {
    sanitizedError = error;
  }

  logger.error({ err: sanitizedError }, "Error no controlado");

  const details =
    env.NODE_ENV === "development" && error instanceof Error
      ? { message: error.message, stack: error.stack?.split("\n").slice(0, 5) }
      : null;

  res.status(500).json({
    success: false,
    message: "Error interno del servidor",
    details
  });
};
