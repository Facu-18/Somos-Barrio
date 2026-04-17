import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { env } from "../config/env";
import { redis } from "../lib/redis";
import { ApiError } from "../utils/api-error";

type JwtPayload = {
  sub: string;
  role: UserRole;
  jti: string;
  iat: number;
  exp: number;
};

export const requireAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new ApiError(401, "No autenticado");

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch {
      throw new ApiError(401, "Token invalido o expirado");
    }

    // Verificar blacklist en Redis (fail-open si Redis no responde)
    try {
      const blacklisted = await redis.get(`bl:${payload.jti}`);
      if (blacklisted) throw new ApiError(401, "Token invalido o expirado");
    } catch (err) {
      if (err instanceof ApiError) throw err;
      // Redis caído → permitir (fail-open)
    }

    req.user = {
      id: payload.sub,
      role: payload.role,
      jti: payload.jti,
      tokenExp: payload.exp
    };

    next();
  } catch (err) {
    next(err);
  }
};

export const requireRole =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) throw new ApiError(401, "No autenticado");
      if (!roles.includes(req.user.role)) {
        throw new ApiError(403, "No tienes permisos para realizar esta accion");
      }
      next();
    } catch (err) {
      next(err);
    }
  };
