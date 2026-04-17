import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes, createHash, randomUUID } from "crypto";
import type { SignOptions } from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { redis } from "../../lib/redis";
import { ApiError } from "../../utils/api-error";

const RT_PREFIX = "rt:";
const BL_PREFIX = "bl:";

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

type AuthResult = {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
};

// ── helpers ──────────────────────────────────────────────────────────────────

const signAccessToken = (userId: string, role: UserRole): string =>
  jwt.sign({ role, jti: randomUUID() }, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"]
  });

const hashToken = (raw: string): string =>
  createHash("sha256").update(raw).digest("hex");

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

async function issueRefreshToken(userId: string): Promise<string> {
  const raw = randomBytes(64).toString("hex");
  const ttl = env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60;
  await redis
    .set(`${RT_PREFIX}${hashToken(raw)}`, userId, "EX", ttl)
    .catch(() => null); // fail-open si Redis no está disponible
  return raw;
}

// ── service ──────────────────────────────────────────────────────────────────

export const authService = {
  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() }
    });
    if (existing) throw new ApiError(409, "El email ya esta registrado");

    let barrioId: string | null = null;
    if (input.barrioSlug) {
      const barrio = await prisma.barrio.findUnique({ where: { slug: input.barrioSlug } });
      if (!barrio) throw new ApiError(400, "El barrio indicado no existe");
      barrioId = barrio.id;
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: { email: input.email.toLowerCase(), name: input.name, passwordHash, barrioId }
    });

    const accessToken = signAccessToken(user.id, user.role);
    const refreshToken = await issueRefreshToken(user.id);
    return { user: toSafeUser(user), accessToken, refreshToken };
  },

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() }
    });
    if (!user || !user.passwordHash) throw new ApiError(401, "Credenciales invalidas");

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) throw new ApiError(401, "Credenciales invalidas");

    const accessToken = signAccessToken(user.id, user.role);
    const refreshToken = await issueRefreshToken(user.id);
    return { user: toSafeUser(user), accessToken, refreshToken };
  },

  async refresh(rawRefreshToken: string): Promise<AuthResult> {
    const hashed = hashToken(rawRefreshToken);
    const userId = await redis.get(`${RT_PREFIX}${hashed}`).catch(() => null);

    if (!userId) throw new ApiError(401, "Refresh token invalido o expirado");

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(401, "Usuario no encontrado");

    // Rotar: borrar el viejo, emitir uno nuevo
    await redis.del(`${RT_PREFIX}${hashed}`).catch(() => null);
    const newRefreshToken = await issueRefreshToken(user.id);
    const accessToken = signAccessToken(user.id, user.role);

    return { user: toSafeUser(user), accessToken, refreshToken: newRefreshToken };
  },

  async logout(jti: string, tokenExp: number, rawRefreshToken?: string): Promise<void> {
    // Blacklist del access token hasta que expire
    const remainingMs = tokenExp * 1000 - Date.now();
    if (remainingMs > 0) {
      await redis
        .set(`${BL_PREFIX}${jti}`, "1", "PX", Math.ceil(remainingMs))
        .catch(() => null);
    }

    // Invalidar refresh token si se envió la cookie
    if (rawRefreshToken) {
      const hashed = hashToken(rawRefreshToken);
      await redis.del(`${RT_PREFIX}${hashed}`).catch(() => null);
    }
  }
};
