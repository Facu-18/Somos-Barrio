import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ── Mocks (deben declararse antes de importar el módulo a testear) ────────────

vi.mock("../../lib/prisma", () => {
  const user = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  };
  return {
    prisma: {
      user,
      pushDevice: { deleteMany: vi.fn() },
      barrio: { findUnique: vi.fn() },
      $transaction: vi.fn(async (callback: (transaction: { user: typeof user }) => unknown) => callback({ user }))
    }
  };
});

vi.mock("../../lib/redis", () => ({
  redis: {
    set: vi.fn().mockResolvedValue("OK"),
    eval: vi.fn().mockResolvedValue(null),
    multi: vi.fn(() => ({
      set: vi.fn().mockReturnThis(),
      del: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([])
    }))
  }
}));

vi.mock("../../config/env", () => ({
  env: {
    JWT_SECRET: "test-secret-that-is-long-enough-32chars",
    JWT_EXPIRES_IN: "15m",
    JWT_REFRESH_EXPIRES_DAYS: 30,
    NODE_ENV: "test",
    CLOUDINARY_CLOUD_NAME: "demo"
  }
}));

// ── Imports después de los mocks ─────────────────────────────────────────────

import { authService } from "./auth.service";
import { prisma } from "../../lib/prisma";

const mockUser = {
  id: "user-cuid-001",
  email: "test@example.com",
  name: "Test User",
  role: "VECINO" as const,
  barrioId: null,
  nickname: "Test User",
  bio: null,
  avatarUrl: null,
  avatarPublicId: null,
  barrio: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  passwordHash: ""
};

describe("authService.register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.barrio.findUnique).mockResolvedValue({ id: "barrio-1", slug: "parque-liceo" } as any);
  });

  it("lanza 409 si el email ya está registrado", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any);

    await expect(
      authService.register({ email: "test@example.com", password: "Pass1234!", name: "Test" })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("lanza 400 si barrioSlug no existe", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.barrio.findUnique).mockResolvedValueOnce(null);

    await expect(
      authService.register({ email: "new@example.com", password: "Pass1234!", name: "Test", barrioSlug: "no-existe" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("crea el usuario y devuelve accessToken + refreshToken", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.user.create).mockResolvedValueOnce({ ...mockUser } as any);

    const result = await authService.register({
      email: "new@example.com",
      password: "Pass1234!",
      name: "New User"
    });

    expect(result.user.email).toBe("test@example.com");
    expect(result.accessToken).toBeDefined();
    expect(typeof result.accessToken).toBe("string");
    expect(result.refreshToken).toBeDefined();
    expect(typeof result.refreshToken).toBe("string");
    expect(result.refreshToken.length).toBeGreaterThan(32);
  });

  it("normaliza el email a minúsculas", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.user.create).mockResolvedValueOnce({ ...mockUser, email: "upper@example.com" } as any);

    const result = await authService.register({
      email: "UPPER@EXAMPLE.COM",
      password: "Pass1234!",
      name: "Test"
    });

    const createCall = vi.mocked(prisma.user.create).mock.calls[0][0];
    expect(createCall.data.email).toBe("upper@example.com");
    expect(createCall.data.barrioId).toBe("barrio-1");
    expect(result.user).toBeDefined();
  });

  it("revierte la transaccion de usuario si no puede persistir la sesion", async () => {
    const { redis } = await import("../../lib/redis");
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.user.create).mockResolvedValueOnce({ ...mockUser } as any);
    vi.mocked(redis.set).mockRejectedValueOnce(new Error("Redis down"));

    await expect(
      authService.register({ email: "new@example.com", password: "Pass1234!", name: "New User" })
    ).rejects.toMatchObject({ statusCode: 503 });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });
});

describe("authService.login", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lanza 401 si el usuario no existe", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

    await expect(
      authService.login({ email: "noexiste@example.com", password: "Pass1234!" })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("lanza 401 si la contraseña es incorrecta", async () => {
    const hash = await bcrypt.hash("correctPass!", 1);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ ...mockUser, passwordHash: hash } as any);

    await expect(
      authService.login({ email: "test@example.com", password: "wrongPass!" })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("devuelve user + tokens con credenciales correctas", async () => {
    const hash = await bcrypt.hash("Pass1234!", 1);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ ...mockUser, passwordHash: hash } as any);

    const result = await authService.login({ email: "test@example.com", password: "Pass1234!" });

    expect(result.user.id).toBe("user-cuid-001");
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });
});

describe("authService.refresh", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lanza 401 si el refresh token no está en Redis", async () => {
    vi.mocked(prisma.user.findUnique as any);
    const { redis } = await import("../../lib/redis");
    vi.mocked(redis.eval).mockResolvedValueOnce(null);

    await expect(
      authService.refresh("token-invalido")
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rota el refresh token y devuelve nuevos tokens", async () => {
    const { redis } = await import("../../lib/redis");
    vi.mocked(redis.eval).mockResolvedValueOnce("user-cuid-001");
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ ...mockUser } as any);

    const result = await authService.refresh("raw-refresh-token-cualquiera");

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(redis.eval).toHaveBeenCalled();
  });

  it("devuelve 503 sin tratar una falla Redis como token invalido", async () => {
    const { redis } = await import("../../lib/redis");
    vi.mocked(redis.eval).mockRejectedValueOnce(new Error("Redis down"));

    await expect(authService.refresh("raw-refresh-token-cualquiera"))
      .rejects.toMatchObject({ statusCode: 503 });
  });
});

describe("authService.logout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pone el jti en blacklist si el token no expiró", async () => {
    const { redis } = await import("../../lib/redis");
    const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1h en el futuro

    await authService.logout("test-jti", futureExp);

    const transaction = vi.mocked(redis.multi).mock.results[0]?.value as any;
    expect(transaction.set).toHaveBeenCalledWith(
      "bl:test-jti",
      "1",
      "PX",
      expect.any(Number)
    );
  });

  it("no guarda en blacklist si el token ya expiró", async () => {
    const { redis } = await import("../../lib/redis");
    const pastExp = Math.floor(Date.now() / 1000) - 100; // expirado

    await authService.logout("test-jti-old", pastExp);

    const transaction = vi.mocked(redis.multi).mock.results[0]?.value as any;
    expect(transaction.set).not.toHaveBeenCalled();
  });
});

describe("authService.mobileLogout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("revoca el refresh y elimina solo el dispositivo coincidente del usuario resuelto", async () => {
    const { redis } = await import("../../lib/redis");
    vi.mocked(redis.eval).mockResolvedValueOnce("user-cuid-001");

    await authService.mobileLogout("r".repeat(64), "ExpoPushToken[token_123456]");

    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("DEL", KEYS[1])'),
      1,
      expect.stringMatching(/^rt:/),
      "",
      "",
      "0"
    );
    expect(prisma.pushDevice.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-cuid-001", token: "ExpoPushToken[token_123456]" }
    });
  });

  it("rechaza un refresh ya consumido sin borrar dispositivos", async () => {
    const { redis } = await import("../../lib/redis");
    vi.mocked(redis.eval).mockResolvedValueOnce(null);
    await expect(authService.mobileLogout("r".repeat(64))).rejects.toMatchObject({ statusCode: 401 });
    expect(prisma.pushDevice.deleteMany).not.toHaveBeenCalled();
  });

  it("revoca un access token vigente y permite que autorice un logout idempotente", async () => {
    const { redis } = await import("../../lib/redis");
    const accessToken = jwt.sign({ role: "VECINO", jti: "mobile-jti" }, "test-secret-that-is-long-enough-32chars", {
      subject: "user-cuid-001",
      expiresIn: "15m"
    });
    vi.mocked(redis.eval).mockResolvedValueOnce("user-cuid-001");

    await authService.mobileLogout("r".repeat(64), undefined, accessToken);

    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("SET", ARGV[2], "1", "PX", ARGV[3])'),
      1,
      expect.stringMatching(/^rt:/),
      "user-cuid-001",
      "bl:mobile-jti",
      expect.stringMatching(/^\d+$/)
    );
  });
});

describe("authService.updateProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rechaza URL e ID de avatar que no pertenecen al Cloudinary configurado", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ avatarPublicId: null } as any);
    await expect(authService.updateProfile("user-cuid-001", {
      avatarUrl: "https://example.com/somos-barrio/avatar.jpg",
      avatarPublicId: "somos-barrio/avatar"
    })).rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("no expone avatarPublicId en la respuesta del perfil", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ avatarPublicId: null } as any);
    vi.mocked(prisma.user.update).mockResolvedValueOnce(mockUser as any);
    const user = await authService.updateProfile("user-cuid-001", { nickname: "Vecino" });
    expect(user).not.toHaveProperty("avatarPublicId");
  });

  it("rechaza avatares fuera del prefijo exclusivo del usuario", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ avatarPublicId: null } as any);
    await expect(authService.updateProfile("user-cuid-001", {
      avatarUrl: "https://res.cloudinary.com/demo/image/upload/somos-barrio/avatars/other-user/avatar.jpg",
      avatarPublicId: "somos-barrio/avatars/other-user/avatar"
    })).rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
