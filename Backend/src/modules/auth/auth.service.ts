import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/api-error";

type RegisterInput = {
  email: string;
  password: string;
  name: string;
  barrioSlug?: string;
};

type LoginInput = {
  email: string;
  password: string;
};

type SafeUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  barrioId: string | null;
};

const signToken = (userId: string, role: UserRole): string =>
  jwt.sign({ role }, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"]
  });

const toSafeUser = (user: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  barrioId: string | null;
}): SafeUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  barrioId: user.barrioId
});

export const authService = {
  async register(input: RegisterInput): Promise<{ user: SafeUser; token: string }> {
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() }
    });

    if (existing) {
      throw new ApiError(409, "El email ya esta registrado");
    }

    let barrioId: string | null = null;
    if (input.barrioSlug) {
      const barrio = await prisma.barrio.findUnique({
        where: { slug: input.barrioSlug }
      });

      if (!barrio) {
        throw new ApiError(400, "El barrio indicado no existe");
      }

      barrioId = barrio.id;
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash,
        barrioId
      }
    });

    const token = signToken(user.id, user.role);
    return { user: toSafeUser(user), token };
  },

  async login(input: LoginInput): Promise<{ user: SafeUser; token: string }> {
    const user = await prisma.user.findUnique({
      where: {
        email: input.email.toLowerCase()
      }
    });

    if (!user || !user.passwordHash) {
      throw new ApiError(401, "Credenciales invalidas");
    }

    const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValidPassword) {
      throw new ApiError(401, "Credenciales invalidas");
    }

    const token = signToken(user.id, user.role);
    return { user: toSafeUser(user), token };
  }
};
