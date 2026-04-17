import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

// ── Mocks (deben declararse antes de importar el módulo a testear) ────────────

vi.mock("../../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn()
    },
    barrio: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock("../../lib/redis", () => ({
  redis: {
    set: vi.fn().mockResolvedValue("OK"),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1)
  }
}));

vi.mock("../../config/env", () => ({
  env: {
    JWT_SECRET: "test-secret-that-is-long-enough-32chars",
    JWT_EXPIRES_IN: "7d",
    JWT_REFRESH_EXPIRES_DAYS: 30,
    NODE_ENV: "test"
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
  passwordHash: ""
};

describe("authService.register", () => {
  beforeEach(() => vi.clearAllMocks());

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
    expect(result.user).toBeDefined();
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
    vi.mocked(redis.get).mockResolvedValueOnce(null);

    await expect(
      authService.refresh("token-invalido")
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rota el refresh token y devuelve nuevos tokens", async () => {
    const { redis } = await import("../../lib/redis");
    vi.mocked(redis.get).mockResolvedValueOnce("user-cuid-001");
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ ...mockUser } as any);

    const result = await authService.refresh("raw-refresh-token-cualquiera");

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    // El viejo token debe haberse borrado
    expect(redis.del).toHaveBeenCalled();
  });
});

describe("authService.logout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pone el jti en blacklist si el token no expiró", async () => {
    const { redis } = await import("../../lib/redis");
    const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1h en el futuro

    await authService.logout("test-jti", futureExp);

    expect(redis.set).toHaveBeenCalledWith(
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

    expect(redis.set).not.toHaveBeenCalledWith(expect.stringContaining("bl:"), expect.anything(), expect.anything(), expect.anything());
  });
});
