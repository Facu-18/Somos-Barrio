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
  avatarUrl: string | null;
  barrioId: string | null;
  barrio: { id: string; name: string; slug: string } | null;
  createdAt: Date;
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
  avatarUrl: string | null;
  barrioId: string | null;
  barrio: { id: string; name: string; slug: string } | null;
  createdAt: Date;
}): SafeUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  avatarUrl: user.avatarUrl,
  barrioId: user.barrioId,
  barrio: user.barrio,
  createdAt: user.createdAt
});

const safeUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  avatarUrl: true,
  barrioId: true,
  createdAt: true,
  barrio: { select: { id: true, name: true, slug: true } }
} as const;

const sessionUnavailable = (): ApiError =>
  new ApiError(503, "El servicio de sesiones no esta disponible");

async function issueRefreshToken(userId: string): Promise<string> {
  const raw = randomBytes(64).toString("hex");
  const ttl = env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60;
  try {
    await redis.set(`${RT_PREFIX}${hashToken(raw)}`, userId, "EX", ttl);
  } catch {
    throw sessionUnavailable();
  }
  return raw;
}

async function rotateRefreshToken(rawRefreshToken: string): Promise<{ userId: string; refreshToken: string }> {
  const nextRaw = randomBytes(64).toString("hex");
  const oldKey = `${RT_PREFIX}${hashToken(rawRefreshToken)}`;
  const nextKey = `${RT_PREFIX}${hashToken(nextRaw)}`;
  const ttl = env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60;
  const script = `
    local userId = redis.call("GET", KEYS[1])
    if not userId then return false end
    redis.call("DEL", KEYS[1])
    redis.call("SET", KEYS[2], userId, "EX", ARGV[1])
    return userId
  `;

  try {
    const userId = await redis.eval(script, 2, oldKey, nextKey, ttl.toString());
    if (typeof userId !== "string") {
      throw new ApiError(401, "Refresh token invalido o expirado");
    }
    return { userId, refreshToken: nextRaw };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw sessionUnavailable();
  }
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
    const { user, refreshToken } = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: { email: input.email.toLowerCase(), name: input.name, passwordHash, barrioId },
        select: safeUserSelect
      });
      const createdRefreshToken = await issueRefreshToken(createdUser.id);
      return { user: createdUser, refreshToken: createdRefreshToken };
    });

    const accessToken = signAccessToken(user.id, user.role);
    return { user: toSafeUser(user), accessToken, refreshToken };
  },

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { barrio: { select: { id: true, name: true, slug: true } } }
    });
    if (!user || !user.passwordHash) throw new ApiError(401, "Credenciales invalidas");

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) throw new ApiError(401, "Credenciales invalidas");

    const accessToken = signAccessToken(user.id, user.role);
    const refreshToken = await issueRefreshToken(user.id);
    return { user: toSafeUser(user), accessToken, refreshToken };
  },

  async refresh(rawRefreshToken: string): Promise<AuthResult> {
    const rotation = await rotateRefreshToken(rawRefreshToken);

    const user = await prisma.user.findUnique({ where: { id: rotation.userId }, select: safeUserSelect });
    if (!user) throw new ApiError(401, "Usuario no encontrado");

    const accessToken = signAccessToken(user.id, user.role);

    return { user: toSafeUser(user), accessToken, refreshToken: rotation.refreshToken };
  },

  async logout(jti: string, tokenExp: number, rawRefreshToken?: string): Promise<void> {
    try {
      const transaction = redis.multi();
      const remainingMs = tokenExp * 1000 - Date.now();
      if (remainingMs > 0) {
        transaction.set(`${BL_PREFIX}${jti}`, "1", "PX", Math.ceil(remainingMs));
      }
      if (rawRefreshToken) {
        transaction.del(`${RT_PREFIX}${hashToken(rawRefreshToken)}`);
      }
      const results = await transaction.exec();
      if (results?.some(([error]) => error !== null)) throw sessionUnavailable();
    } catch {
      throw sessionUnavailable();
    }
  },

  async me(userId: string): Promise<SafeUser> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: safeUserSelect });
    if (!user) throw new ApiError(401, "Usuario no encontrado");
    return toSafeUser(user);
  }
};
