import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { env } from "../config/env";
import { ApiError } from "../utils/api-error";

type JwtPayload = {
  sub: string;
  role: UserRole;
};

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    throw new ApiError(401, "No autenticado");
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = {
      id: payload.sub,
      role: payload.role
    };
    next();
  } catch {
    throw new ApiError(401, "Token invalido o expirado");
  }
};

export const requireRole =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ApiError(401, "No autenticado");
    }

    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, "No tienes permisos para realizar esta accion");
    }

    next();
  };
