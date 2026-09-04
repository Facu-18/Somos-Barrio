import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes, createHash, randomUUID } from "crypto";
import type { SignOptions } from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { redis } from "../../lib/redis";
import { ApiError } from "../../utils/api-error";
import { cloudinary } from "../../lib/cloudinary";
import { logger } from "../../config/logger";

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
  nickname: string | null;
  bio: string | null;
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
  nickname: string | null;
  bio: string | null;
  role: UserRole;
  avatarUrl: string | null;
  avatarPublicId: string | null;
  barrioId: string | null;
  barrio: { id: string; name: string; slug: string } | null;
  createdAt: Date;
}): SafeUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  nickname: user.nickname,
  bio: user.bio,
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
  nickname: true,
  bio: true,
  role: true,
  avatarUrl: true,
  avatarPublicId: true,
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
    const targetSlug = input.barrioSlug || "parque-liceo";
    const barrio = await prisma.barrio.findUnique({ where: { slug: targetSlug } });
    if (!barrio) throw new ApiError(400, "El barrio indicado no existe");
    barrioId = barrio.id;

    const passwordHash = await bcrypt.hash(input.password, 12);
    const { user, refreshToken } = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: { email: input.email.toLowerCase(), name: input.name, nickname: input.name, passwordHash, barrioId },
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

  async mobileLogout(rawRefreshToken: string, pushToken?: string, accessToken?: string): Promise<void> {
    let accessSession: { userId: string; blacklistKey: string; remainingMs: number } | undefined;
    if (accessToken) {
      try {
        const payload = jwt.verify(accessToken, env.JWT_SECRET);
        if (typeof payload === "object" && typeof payload.sub === "string" && typeof payload.jti === "string" && typeof payload.exp === "number") {
          const remainingMs = payload.exp * 1000 - Date.now();
          if (remainingMs > 0) {
            accessSession = { userId: payload.sub, blacklistKey: `${BL_PREFIX}${payload.jti}`, remainingMs: Math.ceil(remainingMs) };
          }
        }
      } catch {
        // The refresh token can still authorize logout when the access token is absent or expired.
      }
    }

    const key = `${RT_PREFIX}${hashToken(rawRefreshToken)}`;
    const script = `
      local userId = redis.call("GET", KEYS[1])
      local accessUserId = ARGV[1]
      if userId and accessUserId ~= "" and userId ~= accessUserId then return "MISMATCH" end
      if userId then redis.call("DEL", KEYS[1]) end
      if accessUserId ~= "" then redis.call("SET", ARGV[2], "1", "PX", ARGV[3]) end
      return userId or accessUserId or false
    `;
    let userId: unknown;
    try {
      userId = await redis.eval(
        script,
        1,
        key,
        accessSession?.userId ?? "",
        accessSession?.blacklistKey ?? "",
        String(accessSession?.remainingMs ?? 0)
      );
    } catch {
      throw sessionUnavailable();
    }
    if (userId === "MISMATCH") throw new ApiError(401, "Las credenciales de sesion no coinciden");
    if (typeof userId !== "string") throw new ApiError(401, "Sesion invalida o expirada");
    if (pushToken) {
      await prisma.pushDevice.deleteMany({ where: { userId, token: pushToken } });
    }
  },

  async me(userId: string): Promise<SafeUser> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: safeUserSelect });
    if (!user) throw new ApiError(401, "Usuario no encontrado");
    return toSafeUser(user);
  },

  async updateProfile(userId: string, data: { nickname?: string | null; bio?: string; avatarUrl?: string; avatarPublicId?: string }): Promise<SafeUser> {
    const current = await prisma.user.findUnique({ where: { id: userId }, select: { avatarPublicId: true } });
    if (!current) throw new ApiError(401, "Usuario no encontrado");

    if (data.avatarUrl && data.avatarPublicId) {
      let parsed: URL;
      try {
        parsed = new URL(data.avatarUrl);
      } catch {
        throw new ApiError(400, "La imagen de perfil no es valida");
      }
      const segments = parsed.pathname.split("/").filter(Boolean).map(decodeURIComponent);
      const assetSegments = segments.slice(3);
      if (assetSegments[0]?.match(/^v\d+$/)) assetSegments.shift();
      const urlPublicId = assetSegments.join("/").replace(/\.[^.]+$/, "");
      const validCloud = parsed.protocol === "https:"
        && parsed.hostname === "res.cloudinary.com"
        && segments[0] === env.CLOUDINARY_CLOUD_NAME
        && segments[1] === "image"
        && segments[2] === "upload";
      const avatarPrefix = `somos-barrio/avatars/${userId}/`;
      if (!validCloud || !data.avatarPublicId.startsWith(avatarPrefix) || urlPublicId !== data.avatarPublicId) {
        throw new ApiError(400, "La URL y el ID de Cloudinary no coinciden");
      }
      const owner = await prisma.user.findFirst({
        where: { avatarPublicId: data.avatarPublicId, id: { not: userId } },
        select: { id: true }
      });
      if (owner) throw new ApiError(409, "La imagen ya pertenece a otro perfil");
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        nickname: data.nickname,
        bio: data.bio,
        avatarUrl: data.avatarUrl === "" ? null : data.avatarUrl,
        avatarPublicId: data.avatarPublicId === "" ? null : data.avatarPublicId
      },
      select: safeUserSelect
    });
    const replacedPublicId = current.avatarPublicId && current.avatarPublicId !== user.avatarPublicId
      ? current.avatarPublicId
      : null;
    if (replacedPublicId && env.NODE_ENV !== "test" && env.CLOUDINARY_CLOUD_NAME
      && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
      void cloudinary.uploader.destroy(replacedPublicId, { resource_type: "image" })
        .catch((error) => logger.warn({ err: error, publicId: replacedPublicId }, "No se pudo borrar avatar reemplazado"));
    }
    return toSafeUser(user);
  }
};
