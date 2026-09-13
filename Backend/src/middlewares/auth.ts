import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { env } from "../config/env";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
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

    try {
      const blacklisted = await redis.get(`bl:${payload.jti}`);
      if (blacklisted) throw new ApiError(401, "Token invalido o expirado");
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(503, "El servicio de sesiones no esta disponible");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, barrio: { select: { slug: true } } }
    });
    if (!user) throw new ApiError(401, "Usuario no encontrado");

    req.user = {
      id: user.id,
      role: user.role,
      jti: payload.jti,
      tokenExp: payload.exp,
      barrioSlug: user.barrio?.slug
    };

    next();
  } catch (err) {
    next(err);
  }
};

// Rutas públicas que muestran más datos al usuario autenticado (p. ej. su contenido en revisión).
// Sin header sigue como anónimo; un token presente pero inválido responde 401 para que el cliente refresque.
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.headers.authorization) return next();
  void requireAuth(req, res, next);
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

export const requireBarrioMember = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    if (!req.user) throw new ApiError(401, "No autenticado");
    const { barrioSlug } = req.params;
    
    // Si la ruta requiere barrioSlug pero el usuario no tiene o no coincide, y no es ADMIN
    if (barrioSlug && req.user.barrioSlug !== barrioSlug && req.user.role !== UserRole.ADMIN) {
      throw new ApiError(403, "No perteneces a este barrio");
    }
    
    next();
  } catch (err) {
    next(err);
  }
};
